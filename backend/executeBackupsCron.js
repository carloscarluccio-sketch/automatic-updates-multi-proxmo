#!/usr/bin/env node
/**
 * Execute Backup Schedules Cron Job
 * Runs pending backup schedules via Proxmox API
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

// Execute backup via Proxmox API
async function executeBackup(schedule, vm, cluster, auth) {
  try {
    console.log(`Executing backup for VM ${vm.vmid} (${vm.name}) on cluster ${cluster.name}`);

    // Prepare backup parameters
    const backupParams = {
      vmid: vm.vmid,
      storage: schedule.storage_location || 'local',
      mode: schedule.mode || 'snapshot',
      compress: schedule.compression || 'zstd',
    };

    // Add optional parameters
    if (schedule.include_ram) {
      backupParams.mode = 'suspend';
    }

    // Execute backup via Proxmox API
    const response = await axios.post(
      `https://${cluster.host}:${cluster.port}/api2/json/nodes/${vm.node}/vzdump`,
      backupParams,
      {
        httpsAgent,
        headers: {
          Cookie: `PVEAuthCookie=${auth.ticket}`,
          CSRFPreventionToken: auth.csrfToken,
        },
      }
    );

    console.log(`Backup initiated for VM ${vm.vmid}: Task ${response.data.data}`);

    return {
      success: true,
      taskId: response.data.data,
      message: `Backup initiated for VM ${vm.vmid}`,
    };
  } catch (error) {
    console.error(`Failed to backup VM ${vm.vmid}:`, error.message);
    return {
      success: false,
      message: error.response?.data?.errors || error.message,
    };
  }
}

// Calculate next run time based on schedule type
function calculateNextRun(scheduleType, scheduleTime) {
  const now = new Date();
  const next = new Date();

  switch (scheduleType) {
    case 'hourly':
      next.setHours(next.getHours() + 1);
      break;

    case 'daily':
      const [hours, minutes] = (scheduleTime || '02:00').split(':');
      next.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;

    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;

    default:
      next.setHours(next.getHours() + 24);
  }

  return next;
}

// Send notification email
async function sendNotification(schedule, result) {
  try {
    if (!schedule.notification_email) return;

    const shouldNotify =
      (result.success && schedule.notify_on_success) ||
      (!result.success && schedule.notify_on_failure);

    if (!shouldNotify) return;

    await prisma.email_queue.create({
      data: {
        to_email: schedule.notification_email,
        subject: `Backup ${result.success ? 'Completed' : 'Failed'}: ${schedule.name}`,
        template_type: 'custom',
        template_data: JSON.stringify({
          schedule_name: schedule.name,
          vm_name: result.vmName,
          status: result.success ? 'Success' : 'Failed',
          message: result.message,
          timestamp: new Date().toISOString(),
        }),
        company_id: schedule.company_id,
        priority: result.success ? 'normal' : 'high',
        status: 'pending',
      },
    });

    console.log(`Notification email queued for ${schedule.notification_email}`);
  } catch (error) {
    console.error('Failed to send notification:', error.message);
  }
}

// Main execution
async function executeBackups() {
  console.log(`\n========================================`);
  console.log(`Execute Backups Cron Job`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`========================================\n`);

  try {
    // Find all pending backup schedules
    const now = new Date();
    const schedules = await prisma.backup_schedules.findMany({
      where: {
        enabled: true,
        next_run: {
          lte: now,
        },
      },
      include: {
        virtual_machines: true,
        proxmox_clusters: true,
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`Found ${schedules.length} pending backup schedule(s)\n`);

    if (schedules.length === 0) {
      console.log('No pending backups to execute');
      await prisma.$disconnect();
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    // Execute each backup
    for (const schedule of schedules) {
      try {
        console.log(`\n--- Processing Schedule: ${schedule.name} ---`);
        console.log(`VM: ${schedule.virtual_machines.name} (${schedule.virtual_machines.vmid})`);
        console.log(`Cluster: ${schedule.proxmox_clusters.name}`);
        console.log(`Mode: ${schedule.mode}, Compression: ${schedule.compression}`);

        // Authenticate with Proxmox
        const auth = await authenticateProxmox(schedule.proxmox_clusters);

        // Execute backup
        const result = await executeBackup(
          schedule,
          schedule.virtual_machines,
          schedule.proxmox_clusters,
          auth
        );

        result.vmName = schedule.virtual_machines.name;

        // Update schedule status
        const nextRun = calculateNextRun(schedule.schedule_type, schedule.schedule_time);

        await prisma.backup_schedules.update({
          where: { id: schedule.id },
          data: {
            last_run: now,
            last_status: result.success ? 'success' : 'failed',
            last_error_message: result.success ? null : result.message,
            next_run: nextRun,
          },
        });

        // Log to backup history
        await prisma.vm_schedule_logs.create({
          data: {
            vm_id: schedule.vm_id,
            schedule_type: 'backup',
            schedule_id: schedule.id,
            action: 'backup_executed',
            status: result.success ? 'success' : 'failed',
            details: JSON.stringify(result),
            executed_at: now,
          },
        });

        // Send notification
        await sendNotification(schedule, result);

        // Log activity
        await prisma.activity_logs.create({
          data: {
            user_id: null,
            company_id: schedule.company_id,
            activity_type: 'backup',
            entity_type: 'vm',
            entity_id: schedule.vm_id,
            action: 'backup_executed',
            description: `Backup executed for VM ${schedule.virtual_machines.vmid} (${schedule.virtual_machines.name})`,
            status: result.success ? 'success' : 'failed',
            metadata: JSON.stringify({
              schedule_id: schedule.id,
              schedule_name: schedule.name,
              task_id: result.taskId,
              error: result.message,
            }),
          },
        });

        if (result.success) {
          successCount++;
          console.log(`✓ Backup successful`);
        } else {
          failureCount++;
          console.log(`✗ Backup failed: ${result.message}`);
        }

        console.log(`Next run scheduled for: ${nextRun.toISOString()}`);
      } catch (error) {
        failureCount++;
        console.error(`Error executing backup for schedule ${schedule.id}:`, error.message);

        // Update schedule with error
        await prisma.backup_schedules.update({
          where: { id: schedule.id },
          data: {
            last_status: 'failed',
            last_error_message: error.message,
            next_run: calculateNextRun(schedule.schedule_type, schedule.schedule_time),
          },
        });
      }
    }

    console.log(`\n========================================`);
    console.log(`Backup Execution Summary`);
    console.log(`Total Schedules: ${schedules.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failureCount}`);
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log(`========================================\n`);
  } catch (error) {
    console.error('Fatal error in backup execution:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  executeBackups()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { executeBackups };
