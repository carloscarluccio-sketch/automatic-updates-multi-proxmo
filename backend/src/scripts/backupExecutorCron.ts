/**
 * Backup Executor Cron Job Entry Point
 *
 * This script runs periodically to execute scheduled backups.
 *
 * Schedule: Every 5 minutes via cron
 * Crontab entry (run every 5 minutes):
 * star-slash-5 star star star star /usr/bin/node /var/www/multpanelreact/backend/dist/scripts/backupExecutorCron.js >> /var/log/backup-executor.log 2>&1
 */

import { executeScheduledBackups } from '../services/backupExecutorService';

async function main() {
  try {
    console.log(`[${new Date().toISOString()}] Starting backup executor cron job`);
    await executeScheduledBackups();
    console.log(`[${new Date().toISOString()}] Backup executor cron job completed successfully`);
    process.exit(0);
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] ERROR in backup executor cron:`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
