#!/usr/bin/env node

/**
 * Subscription Charge Cron Job
 *
 * This script processes subscription charges for companies.
 * It should be run daily via cron or PM2.
 *
 * Usage:
 * - Direct: node dist/scripts/subscriptionChargeCron.js
 * - PM2: pm2 start dist/scripts/subscriptionChargeCron.js --cron "0 2 * * *" --no-autorestart
 *   (Runs at 2 AM every day)
 */

import subscriptionChargeService from '../services/subscriptionChargeService';
import logger from '../utils/logger';

async function runSubscriptionCharges() {
  try {
    logger.info('========================================');
    logger.info('Subscription charge cron job started');
    logger.info(`Timestamp: ${new Date().toISOString()}`);
    logger.info('========================================');

    // Process subscription charges
    const chargeResults = await subscriptionChargeService.processSubscriptionCharges();

    logger.info('Subscription charge results:', {
      processed: chargeResults.processed,
      charged: chargeResults.charged,
      failed: chargeResults.failed,
      errors: chargeResults.errors.length
    });

    if (chargeResults.errors.length > 0) {
      logger.error('Errors during subscription charging:', chargeResults.errors);
    }

    // Check for past due subscriptions
    const pastDueCount = await subscriptionChargeService.checkPastDueSubscriptions();
    if (pastDueCount > 0) {
      logger.warn(`Marked ${pastDueCount} subscriptions as past due`);
    }

    // Cancel subscriptions that are too far past due
    const cancelledCount = await subscriptionChargeService.cancelPastDueSubscriptions();
    if (cancelledCount > 0) {
      logger.warn(`Cancelled ${cancelledCount} past due subscriptions`);
    }

    logger.info('========================================');
    logger.info('Subscription charge cron job completed successfully');
    logger.info('========================================');

    return {
      ...chargeResults,
      pastDueMarked: pastDueCount,
      pastDueCancelled: cancelledCount
    };
  } catch (error) {
    logger.error('========================================');
    logger.error('Subscription charge cron job ERROR:');
    logger.error(error);
    logger.error('========================================');
    throw error;
  }
}

// Run immediately if executed directly
if (require.main === module) {
  runSubscriptionCharges()
    .then((result) => {
      console.log('Subscription charge processing completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error in subscription charge processing:', error);
      process.exit(1);
    });
}

export default runSubscriptionCharges;
