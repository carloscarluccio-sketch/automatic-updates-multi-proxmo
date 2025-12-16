#!/usr/bin/env node
/**
 * Execute Snapshot Schedules Cron Job
 * Runs pending snapshot schedules via Proxmox API
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

// List existing snapshots for a VM
async function listSnapshots(vm, cluster, auth) {
  try {
    const response = await axios.get(
      `https://${cluster.host}:${cluster.port}/api2/json/nodes/${vm.node}/qemu/${vm.vmid}/snapshot`,
      {
        httpsAgent,
        headers: {
          Cookie: `PVEAuthCookie=${auth.ticket}`,
        },
      }
    );

    // Filter out current state
    return response.data.data.filter((snap) => snap.name !== 'current');
  } catch (error) {
    console.error(`Failed to list snapshots for VM ${vm.vmid}:`, error.message);
    return [];
  }
}

// Delete snapshot
async function deleteSnapshot(vm, cluster, auth, snapshotName) {
  try {
    await axios.delete(
      `https://${cluster.host}:${cluster.port}/api2/json/nodes/${vm.node}/qemu/${vm.vmid}/snapshot/${snapshotName}`,
      {
        httpsAgent,
        headers: {
          Cookie: `PVEAuthCookie=${auth.ticket}`,
          CSRFPreventionToken: auth.csrfToken,
        },
      }
    );

    console.log(`  Deleted old snapshot: ${snapshotName}`);
    return true;
  } catch (error) {
    console.error(`  Failed to delete snapshot ${snapshotName}:`, error.message);
    return false;
  }
}

// Cleanup old snapshots based on retention count
async function cleanupOldSnapshots(schedule, vm, cluster, auth) {
  try {
    const snapshots = await listSnapshots(vm, cluster, auth);
    const retentionCount = schedule.retention_count || 7;

    // Filter snapshots created by this schedule (by naming convention)
    const scheduleSnapshots = snapshots.filter((snap) =>
      snap.name.startsWith(`auto-${schedule.id}-`)
    );

    console.log(`  Found ${scheduleSnapshots.length} existing snapshot(s), retention: ${retentionCount}`);

    if (scheduleSnapshots.length >= retentionCount) {
      // Sort by timestamp (oldest first)
      scheduleSnapshots.sort((a, b) => a.snaptime - b.snaptime);

      // Delete oldest snapshots to make room
      const toDelete = scheduleSnapshots.length - retentionCount + 1;
      for (let i = 0; i < toDelete; i++) {
        await deleteSnapshot(vm, cluster, auth, scheduleSnapshots[i].name);
      }
    }
  } catch (error) {
    console.error(`Failed to cleanup old snapshots:`, error.message);
  }
}

// Create snapshot via Proxmox API
async function createSnapshot(schedule, vm, cluster, auth) {
  try {
    console.log(`Creating snapshot for VM ${vm.vmid} (${vm.name}) on cluster ${cluster.name}`);

    // Cleanup old snapshots first
    await cleanupOldSnapshots(schedule, vm, cluster, auth);

    // Generate snapshot name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const snapshotName = `auto-${schedule.id}-${timestamp}`;

    // Create snapshot via Proxmox API
    const response = await axios.post(
      `https://${cluster.host}:${cluster.port}/api2/json/nodes/${vm.node}/qemu/${vm.vmid}/snapshot`,
      new URLSearchParams({
        snapname: snapshotName,
        description: `Automated snapshot from schedule: ${schedule.id}`,
        vmstate: '0', // Don't include RAM state
      }),
      {
        httpsAgent,
        headers: {
          Cookie: `PVEAuthCookie=${auth.ticket}`,
          CSRFPreventionToken: auth.csrfToken,
        },
      }
    );

    console.log(`  Snapshot created: ${snapshotName}`);

    return {
      success: true,
      snapshotName: snapshotName,
      message: `Snapshot created for VM ${vm.vmid}`,
    };
  } catch (error) {
    console.error(`Failed to create snapshot for VM ${vm.vmid}:`, error.message);
    return {
      success: false,
      message: error.response?.data?.errors || error.message,
    };
  }
}

// Calculate next run time based on schedule type and value
function calculateNextRun(scheduleType, scheduleValue) {
  const now = new Date();
  const next = new Date();

  switch (scheduleType) {
    case 'hourly':
      next.setHours(next.getHours() + (scheduleValue || 1));
      break;

    case 'daily':
      next.setDate(next.getDate() + (scheduleValue || 1));
      break;

    case 'weekly':
      next.setDate(next.getDate() + 7 * (scheduleValue || 1));
      break;

    case 'monthly':
      next.setMonth(next.getMonth() + (scheduleValue || 1));
      break;

    default:
      next.setHours(next.getHours() + 24);
  }

  return next;
}

// Main execution
async function executeSnapshots() {
  console.log(`\n========================================`);
  console.log(`Execute Snapshots Cron Job`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`========================================\n`);

  try {
    // Find all pending snapshot schedules
    const now = new Date();
    const schedules = await prisma.snapshot_schedules.findMany({
      where: {
        enabled: true,
        next_run: {
          lte: now,
        },
      },
      include: {
        virtual_machines: {
          include: {
            proxmox_clusters: true,
          },
        },
      },
    });

    console.log(`Found ${schedules.length} pending snapshot schedule(s)\n`);

    if (schedules.length === 0) {
      console.log('No pending snapshots to execute');
      await prisma.$disconnect();
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    // Execute each snapshot
    for (const schedule of schedules) {
      try {
        const vm = schedule.virtual_machines;
        const cluster = vm.proxmox_clusters;

        console.log(`\n--- Processing Schedule ID: ${schedule.id} ---`);
        console.log(`VM: ${vm.name} (${vm.vmid})`);
        console.log(`Cluster: ${cluster.name}`);
        console.log(`Schedule: ${schedule.schedule_type} (every ${schedule.schedule_value || 1})`);
        console.log(`Retention: ${schedule.retention_count} snapshot(s)`);

        // Authenticate with Proxmox
        const auth = await authenticateProxmox(cluster);

        // Create snapshot
        const result = await createSnapshot(schedule, vm, cluster, auth);

        result.vmName = vm.name;

        // Update schedule status
        const nextRun = calculateNextRun(schedule.schedule_type, schedule.schedule_value);

        await prisma.snapshot_schedules.update({
          where: { id: schedule.id },
          data: {
            last_run: now,
            last_status: result.success ? 'success' : 'failed',
            last_error_message: result.success ? null : result.message,
            next_run: nextRun,
          },
        });

        // Log to schedule history
        await prisma.vm_schedule_logs.create({
          data: {
            vm_id: schedule.vm_id,
            schedule_type: 'snapshot',
            schedule_id: schedule.id,
            action: 'snapshot_created',
            status: result.success ? 'success' : 'failed',
            details: JSON.stringify(result),
            executed_at: now,
          },
        });

        // Log activity
        await prisma.activity_logs.create({
          data: {
            user_id: null,
            company_id: vm.company_id,
            activity_type: 'snapshot',
            entity_type: 'vm',
            entity_id: schedule.vm_id,
            action: 'snapshot_created',
            description: `Snapshot created for VM ${vm.vmid} (${vm.name})`,
            status: result.success ? 'success' : 'failed',
            metadata: JSON.stringify({
              schedule_id: schedule.id,
              snapshot_name: result.snapshotName,
              error: result.message,
            }),
          },
        });

        if (result.success) {
          successCount++;
          console.log(`✓ Snapshot successful`);
        } else {
          failureCount++;
          console.log(`✗ Snapshot failed: ${result.message}`);
        }

        console.log(`Next run scheduled for: ${nextRun.toISOString()}`);
      } catch (error) {
        failureCount++;
        console.error(`Error executing snapshot for schedule ${schedule.id}:`, error.message);

        // Update schedule with error
        await prisma.snapshot_schedules.update({
          where: { id: schedule.id },
          data: {
            last_status: 'failed',
            last_error_message: error.message,
            next_run: calculateNextRun(schedule.schedule_type, schedule.schedule_value),
          },
        });
      }
    }

    console.log(`\n========================================`);
    console.log(`Snapshot Execution Summary`);
    console.log(`Total Schedules: ${schedules.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failureCount}`);
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log(`========================================\n`);
  } catch (error) {
    console.error('Fatal error in snapshot execution:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  executeSnapshots()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { executeSnapshots };
