// Daily Usage Aggregation Cron Job
// Schedule: Daily at 1 AM

import { aggregateDailyUsage } from '../services/usageAggregationService';
import logger from '../utils/logger';

async function main() {
  try {
    console.log(`[${new Date().toISOString()}] Starting daily usage aggregation cron job`);

    await aggregateDailyUsage();

    console.log(`[${new Date().toISOString()}] Daily aggregation completed successfully`);
    process.exit(0);
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] ERROR:`, error.message);
    logger.error('Usage aggregation cron failed:', error);
    process.exit(1);
  }
}

main();
