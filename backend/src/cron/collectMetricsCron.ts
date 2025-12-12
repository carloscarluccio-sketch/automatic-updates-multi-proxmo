// PAYG Metrics Collection Cron Job
// Schedule: Every 5 minutes

import { collectAllMetrics, cleanupOldMetrics } from '../services/metricsCollectionService';
import logger from '../utils/logger';

async function main() {
  try {
    console.log(`[${new Date().toISOString()}] Starting metrics collection cron job`);

    await collectAllMetrics();

    const currentHour = new Date().getHours();
    const currentMinute = new Date().getMinutes();

    if (currentHour === 0 && currentMinute < 5) {
      console.log('Running daily cleanup of old metrics...');
      await cleanupOldMetrics();
    }

    console.log(`[${new Date().toISOString()}] Metrics collection completed successfully`);
    process.exit(0);
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] ERROR:`, error.message);
    logger.error('Metrics collection cron failed:', error);
    process.exit(1);
  }
}

main();
