#!/usr/bin/env node

/**
 * Email Processor Cron Job
 *
 * This script processes the email queue and sends pending emails.
 * It should be run every 1-5 minutes via cron or PM2.
 *
 * Usage:
 * - Direct: node dist/scripts/emailProcessorCron.js
 */

import { emailProcessor } from '../services/emailProcessorService';
import logger from '../utils/logger';

async function runEmailProcessor() {
  try {
    logger.info('========================================');
    logger.info('Email processor cron job started');
    logger.info(`Timestamp: ${new Date().toISOString()}`);
    logger.info('========================================');

    // Process email queue
    const result = await emailProcessor.processEmailQueue();

    logger.info('Email processor results:', {
      processed: result.processed,
      sent: result.sent,
      failed: result.failed
    });

    // Retry failed emails that are ready for retry
    const retriedCount = await emailProcessor.retryFailedEmails();
    if (retriedCount > 0) {
      logger.info(`Reset ${retriedCount} failed emails for retry`);
    }

    logger.info('========================================');
    logger.info('Email processor cron job completed successfully');
    logger.info('========================================');

    return result;
  } catch (error) {
    logger.error('========================================');
    logger.error('Email processor cron job ERROR:');
    logger.error(error);
    logger.error('========================================');
    throw error;
  }
}

// Run immediately if executed directly
if (require.main === module) {
  runEmailProcessor()
    .then((result) => {
      console.log('Email processor completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error in email processor:', error);
      process.exit(1);
    });
}

export default runEmailProcessor;
