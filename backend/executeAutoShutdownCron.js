#!/usr/bin/env node
/**
 * VM Auto-Shutdown Cron Job
 * Shuts down idle VMs based on auto-shutdown settings
 * Schedule: Every hour (0 * * * *)
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const https = require('https');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Create HTTPS agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// Decrypt password
function decrypt(encryptedText) {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-32-character-key-here!!', 'utf8');

  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = Buffer.from(parts.join(':'), 'hex');

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

// Proxmox API authentication
async function authenticateProxmox(cluster) {
  try {
    const password = decrypt(cluster.password_encrypted);

    const response = await axios.post(
      `https://${cluster.host}:${cluster.port}/api2/json/access/ticket`,
      new URLSearchParams({
        username: cluster.username,
        password: password,
        realm: 'pam',
      }),
      { httpsAgent }
    );

    return {
      ticket: response.data.data.ticket,
      csrfToken: response.data.data.CSRFPreventionToken,
    };
  } catch (error) {
    console.error(`Failed to authenticate with Proxmox cluster ${cluster.id}:`, error.message);
    throw error;
  }
}

// Get VM status via Proxmox API
async function getVMStatus(vm, cluster, auth) {
  try {
    const response = await axios.get(
      `https://${cluster.host}:${cluster.port}/api2/json/nodes/${vm.node}/qemu/${vm.vmid}/status/current`,
      {
        httpsAgent,
        headers: {
          Cookie: `PVEAuthCookie=${auth.ticket}`,
        },
      }
    );

    return response.data.data;
  } catch (error) {
    console.error(`Failed to get status for VM ${vm.vmid}:`, error.message);
    return null;
  }
}

// Shutdown VM via Proxmox API
async function shutdownVM(vm, cluster, auth) {
  try {
    const response = await axios.post(
      `https://${cluster.host}:${cluster.port}/api2/json/nodes/${vm.node}/qemu/${vm.vmid}/status/shutdown`,
      {},
      {
        httpsAgent,
        headers: {
          Cookie: `PVEAuthCookie=${auth.ticket}`,
          CSRFPreventionToken: auth.csrfToken,
        },
      }
    );

    console.log(`  VM ${vm.vmid} (${vm.name}) shutdown initiated`);
    return {
      success: true,
      taskId: response.data.data,
    };
  } catch (error) {
    console.error(`  Failed to shutdown VM ${vm.vmid}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Calculate idle hours
function calculateIdleHours(lastActivity) {
  if (!lastActivity) return null;

  const now = new Date();
  const lastActivityDate = new Date(lastActivity);
  const diffMs = now - lastActivityDate;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  return diffHours;
}

// Main execution
async function executeAutoShutdown() {
  console.log(`\n========================================`);
  console.log(`VM Auto-Shutdown Cron Job`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`========================================\n`);

  try {
    // Find all VMs with auto-shutdown enabled
    const vms = await prisma.virtual_machines.findMany({
      where: {
        auto_shutdown_enabled: true,
        status: 'running', // Only check running VMs
      },
      include: {
        proxmox_clusters: true,
      },
    });

    console.log(`Found ${vms.length} VM(s) with auto-shutdown enabled\n`);

    if (vms.length === 0) {
      console.log('No VMs to process');
      await prisma.$disconnect();
      return;
    }

    let shutdownCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const vm of vms) {
      try {
        const cluster = vm.proxmox_clusters;
        const idleHours = calculateIdleHours(vm.last_activity_at);

        console.log(`\n--- Processing VM: ${vm.name} (${vm.vmid}) ---`);
        console.log(`Cluster: ${cluster.name}`);
        console.log(`Auto-shutdown threshold: ${vm.auto_shutdown_idle_hours} hours`);
        console.log(`Last activity: ${vm.last_activity_at || 'Never'}`);
        console.log(`Idle hours: ${idleHours !== null ? idleHours : 'Unknown'}`);

        // Skip if we can't determine idle time
        if (idleHours === null) {
          console.log(`  Skipping: No last activity timestamp`);
          skipCount++;
          continue;
        }

        // Check if VM has been idle long enough
        if (idleHours < vm.auto_shutdown_idle_hours) {
          console.log(`  Skipping: Not idle long enough (${idleHours}/${vm.auto_shutdown_idle_hours} hours)`);
          skipCount++;
          continue;
        }

        // Authenticate with Proxmox
        const auth = await authenticateProxmox(cluster);

        // Get current VM status to confirm it's still running
        const status = await getVMStatus(vm, cluster, auth);

        if (!status || status.status !== 'running') {
          console.log(`  Skipping: VM not running (status: ${status?.status || 'unknown'})`);
          skipCount++;
          continue;
        }

        // Shutdown the VM
        console.log(`  Shutting down VM (idle for ${idleHours} hours)`);
        const result = await shutdownVM(vm, cluster, auth);

        if (result.success) {
          shutdownCount++;

          // Update VM status in database
          await prisma.virtual_machines.update({
            where: { id: vm.id },
            data: { status: 'stopped' },
          });

          // Log shutdown
          await prisma.vm_auto_shutdown_log.create({
            data: {
              vm_id: vm.id,
              reason: 'idle_timeout',
              idle_hours: idleHours,
            },
          });

          // Log activity
          await prisma.activity_logs.create({
            data: {
              user_id: null,
              company_id: vm.company_id,
              activity_type: 'vm_management',
              entity_type: 'vm',
              entity_id: vm.id,
              action: 'auto_shutdown',
              description: `VM ${vm.name} (${vm.vmid}) automatically shutdown after ${idleHours} hours of inactivity`,
              status: 'success',
              metadata: JSON.stringify({
                idle_hours: idleHours,
                threshold: vm.auto_shutdown_idle_hours,
              }),
            },
          });

          console.log(`  ✓ VM shutdown successful`);
        } else {
          errorCount++;
          console.log(`  ✗ VM shutdown failed: ${result.error}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error processing VM ${vm.id}:`, error.message);
      }
    }

    console.log(`\n========================================`);
    console.log(`Auto-Shutdown Summary`);
    console.log(`Total VMs checked: ${vms.length}`);
    console.log(`VMs shutdown: ${shutdownCount}`);
    console.log(`VMs skipped: ${skipCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log(`========================================\n`);
  } catch (error) {
    console.error('Fatal error in auto-shutdown execution:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  executeAutoShutdown()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { executeAutoShutdown };
