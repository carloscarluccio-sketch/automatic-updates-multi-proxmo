/**
 * Backup Executor Service
 *
 * Handles scheduled backup execution, including:
 * - Finding due backup schedules
 * - Executing backups via Proxmox API
 * - Logging backup history
 * - Sending email notifications
 * - Managing backup retention
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as nodemailer from 'nodemailer';

const prisma = new PrismaClient();

interface ProxmoxCluster {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  password_encrypted: string;
}

interface BackupSchedule {
  id: number;
  name: string;
  company_id: number;
  cluster_id: number | null;
  vm_id: number | null;
  schedule_type: string;
  schedule_time: string | null;
  schedule_cron: string | null;
  retention_days: number | null;
  retention_count: number | null;
  compression: string | null;
  mode: string | null;
  storage_location: string | null;
  notification_email: string | null;
  notify_on_success: boolean | null;
  notify_on_failure: boolean | null;
  enabled: boolean | null;
  next_run: Date | null;
  last_run: Date | null;
  virtual_machines: { id: number; vmid: number; name: string; node: string } | null;
  proxmox_clusters: ProxmoxCluster | null;
  companies: { id: number; name: string };
}

// Decrypt password (XOR encryption - matches EncryptionService)
function decryptPassword(encrypted: string): string {
  const key = process.env.ENCRYPTION_KEY || 'default-key-change-me';
  let decrypted = '';
  for (let i = 0; i < encrypted.length; i++) {
    decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return decrypted;
}

// Get Proxmox API ticket
async function getProxmoxTicket(cluster: ProxmoxCluster): Promise<{ ticket: string; csrf: string }> {
  const password = decryptPassword(cluster.password_encrypted);
  const url = `https://${cluster.host}:${cluster.port}/api2/json/access/ticket`;

  const response = await axios.post(url, {
    username: cluster.username,
    password: password,
  }, {
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
  });

  return {
    ticket: response.data.data.ticket,
    csrf: response.data.data.CSRFPreventionToken,
  };
}

// Execute backup via Proxmox API
async function executeBackup(
  schedule: BackupSchedule,
  auth: { ticket: string; csrf: string },
  nodeName: string
): Promise<{
  success: boolean;
  taskId?: string;
  message: string;
  backupSize?: number;
}> {
  const cluster = schedule.proxmox_clusters;
  const vmid = schedule.virtual_machines?.vmid;

  if (!cluster) {
    return { success: false, message: 'Cluster not found' };
  }

  if (!vmid) {
    return { success: false, message: 'VM not found' };
  }

  const url = `https://${cluster.host}:${cluster.port}/api2/json/nodes/${nodeName}/vzdump`;

  try {
    const response = await axios.post(url, {
      vmid: vmid.toString(),
      compress: schedule.compression || 'zstd',
      mode: schedule.mode || 'snapshot',
      storage: schedule.storage_location || 'local',
      remove: 0, // Don't remove after backup
    }, {
      headers: {
        'Cookie': `PVEAuthCookie=${auth.ticket}`,
        'CSRFPreventionToken': auth.csrf,
      },
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });

    return {
      success: true,
      taskId: response.data.data,
      message: 'Backup task started successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.errors || error.message,
    };
  }
}

// Check backup task status
async function checkBackupStatus(
  cluster: ProxmoxCluster,
  taskId: string,
  nodeName: string,
  auth: { ticket: string; csrf: string }
): Promise<{ status: string; exitStatus?: string }> {
  const url = `https://${cluster.host}:${cluster.port}/api2/json/nodes/${nodeName}/tasks/${taskId}/status`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Cookie': `PVEAuthCookie=${auth.ticket}`,
      },
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });

    return {
      status: response.data.data.status,
      exitStatus: response.data.data.exitstatus,
    };
  } catch (error) {
    return { status: 'error' };
  }
}

// Send email notification
async function sendNotification(
  email: string,
  subject: string,
  message: string
): Promise<void> {
  if (!email) return;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@proxmox-panel.local',
      to: email,
      subject: subject,
      html: message,
    });
    console.log(`✅ Notification sent to ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${email}:`, error);
  }
}

// Calculate next run time based on schedule
function calculateNextRun(scheduleType: string, scheduleTime: string | null): Date {
  const now = new Date();

  switch (scheduleType) {
    case 'once':
      // One-time backup, set to far future to disable
      return new Date('2099-12-31');

    case 'hourly':
      // Next hour
      now.setHours(now.getHours() + 1, 0, 0, 0);
      return now;

    case 'daily':
      // Next occurrence of specified time (HH:MM format)
      if (scheduleTime) {
        const [hours, minutes] = scheduleTime.split(':').map(Number);
        now.setHours(hours, minutes, 0, 0);
        if (now <= new Date()) {
          now.setDate(now.getDate() + 1);
        }
      } else {
        now.setDate(now.getDate() + 1);
      }
      return now;

    case 'weekly':
      // Next occurrence of specified day (0-6, Sunday-Saturday)
      if (scheduleTime) {
        const targetDay = parseInt(scheduleTime);
        const currentDay = now.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;
        now.setDate(now.getDate() + daysToAdd);
        now.setHours(0, 0, 0, 0);
      } else {
        now.setDate(now.getDate() + 7);
      }
      return now;

    case 'monthly':
      // Next occurrence of specified day of month (1-31)
      if (scheduleTime) {
        const targetDate = parseInt(scheduleTime);
        now.setDate(targetDate);
        if (now <= new Date()) {
          now.setMonth(now.getMonth() + 1);
        }
        now.setHours(0, 0, 0, 0);
      } else {
        now.setMonth(now.getMonth() + 1, 1);
      }
      return now;

    default:
      // Default: 24 hours from now
      now.setDate(now.getDate() + 1);
      return now;
  }
}

// Cleanup old backups based on retention policy
async function cleanupOldBackups(scheduleId: number, retentionDays: number | null, retentionCount: number | null): Promise<void> {
  try {
    if (retentionDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      await prisma.backup_history.deleteMany({
        where: {
          schedule_id: scheduleId,
          started_at: {
            lt: cutoffDate,
          },
          status: {
            in: ['completed', 'expired'],
          },
        },
      });
    } else if (retentionCount) {
      // Keep only the latest N backups
      const backups = await prisma.backup_history.findMany({
        where: { schedule_id: scheduleId },
        orderBy: { started_at: 'desc' },
        skip: retentionCount,
      });

      if (backups.length > 0) {
        await prisma.backup_history.deleteMany({
          where: {
            id: {
              in: backups.map(b => b.id),
            },
          },
        });
      }
    }
  } catch (error) {
    console.error(`Failed to cleanup old backups for schedule ${scheduleId}:`, error);
  }
}

// Main execution function
export async function executeScheduledBackups(): Promise<void> {
  console.log(`\n🔄 [${new Date().toISOString()}] Starting backup executor...`);

  try {
    // Find all enabled schedules that are due to run
    const dueSchedules = await prisma.backup_schedules.findMany({
      where: {
        enabled: true,
        next_run: {
          lte: new Date(),
        },
      },
      include: {
        virtual_machines: {
          select: {
            id: true,
            vmid: true,
            name: true,
            node: true,
          },
        },
        proxmox_clusters: true,
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }) as any[];

    console.log(`📋 Found ${dueSchedules.length} schedules due for execution`);

    for (const schedule of dueSchedules) {
      console.log(`\n⏱️  Processing schedule ${schedule.id}: ${schedule.name} - ${schedule.virtual_machines?.name || 'Unknown VM'}`);

      try {
        if (!schedule.proxmox_clusters) {
          console.log(`❌ No cluster configured for schedule ${schedule.id}`);
          continue;
        }

        if (!schedule.virtual_machines) {
          console.log(`❌ No VM configured for schedule ${schedule.id}`);
          continue;
        }

        // Get Proxmox authentication
        const auth = await getProxmoxTicket(schedule.proxmox_clusters);

        const startTime = new Date();

        // Create backup history record
        const backupHistory = await prisma.backup_history.create({
          data: {
            schedule_id: schedule.id,
            company_id: schedule.company_id,
            vm_id: schedule.vm_id!,
            vm_name: schedule.virtual_machines.name,
            cluster_id: schedule.cluster_id!,
            node_name: schedule.virtual_machines.node,
            backup_type: 'scheduled',
            backup_mode: schedule.mode || 'snapshot',
            compression: schedule.compression || 'zstd',
            status: 'running',
            started_at: startTime,
          },
        });

        // Execute backup
        const result = await executeBackup(schedule, auth, schedule.virtual_machines.node);

        if (result.success && result.taskId) {
          console.log(`✅ Backup task started: ${result.taskId}`);

          // Wait for backup to complete (max 5 minutes polling)
          let taskStatus: { status: string; exitStatus?: string } = { status: 'running', exitStatus: undefined };
          let attempts = 0;
          const maxAttempts = 60; // 60 attempts * 5 seconds = 5 minutes

          while (taskStatus.status === 'running' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            taskStatus = await checkBackupStatus(
              schedule.proxmox_clusters,
              result.taskId,
              schedule.virtual_machines.node,
              auth
            );
            attempts++;
          }

          const success = taskStatus.exitStatus === 'OK';
          const endTime = new Date();
          const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

          // Update backup history
          await prisma.backup_history.update({
            where: { id: backupHistory.id },
            data: {
              completed_at: endTime,
              status: success ? 'completed' : 'failed',
              error_message: success ? null : taskStatus.exitStatus,
              duration_seconds: durationSeconds,
            },
          });

          // Send notification
          if (schedule.notification_email) {
            if ((success && schedule.notify_on_success) || (!success && schedule.notify_on_failure)) {
              const subject = success
                ? `✅ Backup Completed: ${schedule.virtual_machines.name}`
                : `❌ Backup Failed: ${schedule.virtual_machines.name}`;

              const message = `
                <h2>Backup ${success ? 'Completed Successfully' : 'Failed'}</h2>
                <p><strong>Schedule:</strong> ${schedule.name}</p>
                <p><strong>VM:</strong> ${schedule.virtual_machines.name} (VMID: ${schedule.virtual_machines.vmid})</p>
                <p><strong>Cluster:</strong> ${schedule.proxmox_clusters.name}</p>
                <p><strong>Company:</strong> ${schedule.companies.name}</p>
                <p><strong>Started:</strong> ${startTime.toLocaleString()}</p>
                <p><strong>Duration:</strong> ${durationSeconds} seconds</p>
                <p><strong>Status:</strong> ${success ? 'Success' : 'Failed'}</p>
                ${!success ? `<p><strong>Error:</strong> ${taskStatus.exitStatus}</p>` : ''}
              `;

              await sendNotification(schedule.notification_email, subject, message);
            }
          }

          // Cleanup old backups
          await cleanupOldBackups(schedule.id, schedule.retention_days, schedule.retention_count);

          console.log(`${success ? '✅' : '❌'} Backup ${success ? 'completed' : 'failed'}`);
        } else {
          // Backup failed to start
          const endTime = new Date();
          const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

          await prisma.backup_history.update({
            where: { id: backupHistory.id },
            data: {
              completed_at: endTime,
              status: 'failed',
              error_message: result.message,
              duration_seconds: durationSeconds,
            },
          });

          if (schedule.notification_email && schedule.notify_on_failure) {
            await sendNotification(
              schedule.notification_email,
              `❌ Backup Failed to Start: ${schedule.virtual_machines.name}`,
              `<h2>Backup Failed to Start</h2><p><strong>Schedule:</strong> ${schedule.name}</p><p><strong>Error:</strong> ${result.message}</p>`
            );
          }

          console.log(`❌ Backup failed to start: ${result.message}`);
        }

        // Update schedule's next_run and last_run
        const nextRun = calculateNextRun(schedule.schedule_type, schedule.schedule_time);
        await prisma.backup_schedules.update({
          where: { id: schedule.id },
          data: {
            last_run: new Date(),
            next_run: nextRun,
            last_status: result.success ? 'success' : 'failed',
            last_error: result.success ? null : result.message,
          },
        });

        console.log(`📅 Next run scheduled for: ${nextRun.toLocaleString()}`);

      } catch (error: any) {
        console.error(`❌ Error processing schedule ${schedule.id}:`, error.message);

        // Send failure notification
        if (schedule.notification_email && schedule.notify_on_failure) {
          await sendNotification(
            schedule.notification_email,
            `❌ Backup Error: ${schedule.virtual_machines?.name || 'Unknown VM'}`,
            `<h2>Backup Execution Error</h2><p><strong>Schedule:</strong> ${schedule.name}</p><p><strong>Error:</strong> ${error.message}</p>`
          );
        }

        // Update schedule with error
        await prisma.backup_schedules.update({
          where: { id: schedule.id },
          data: {
            last_status: 'failed',
            last_error: error.message,
          },
        });
      }
    }

    console.log(`\n✅ Backup executor completed successfully`);

  } catch (error) {
    console.error(`❌ Fatal error in backup executor:`, error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
