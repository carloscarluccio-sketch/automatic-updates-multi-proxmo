#!/bin/bash
# Email Queue Processing Script
# Processes pending emails in the queue
# Runs every 2 minutes via cron

cd /var/www/multpanelreact/backend || exit 1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting email queue processing..."

# Process email queue using Node.js
node -e "
const { processEmailQueue, retryFailedEmails } = require('./dist/services/emailQueueService');

Promise.all([
  processEmailQueue(20),  // Process up to 20 emails
  retryFailedEmails(5)    // Retry up to 5 failed emails
])
.then(([processResult, retryResult]) => {
  console.log('[$(date '+%Y-%m-%d %H:%M:%S')] Email processing complete');
  console.log('Processed:', processResult.sent, 'sent,', processResult.failed, 'failed');
  console.log('Retried:', retryResult.retried, 'succeeded,', retryResult.failed, 'failed');
  process.exit(0);
})
.catch((error) => {
  console.error('[$(date '+%Y-%m-%d %H:%M:%S')] Email processing error:', error.message);
  process.exit(1);
});
" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Email processing finished"
