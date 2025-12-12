#!/bin/bash
# Resource Monitoring Automation Script
# Runs alert monitoring and auto-resolution every 5 minutes

cd /var/www/multpanelreact/backend || exit 1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting resource monitoring cycle..."

# Run monitoring using Node.js
node -e "
const { monitorResourceAlerts, autoResolveAlerts } = require('./dist/services/resourceMonitoringService');

Promise.all([
  monitorResourceAlerts(),
  autoResolveAlerts()
])
.then(() => {
  console.log('[$(date '+%Y-%m-%d %H:%M:%S')] Monitoring cycle complete');
  process.exit(0);
})
.catch((error) => {
  console.error('[$(date '+%Y-%m-%d %H:%M:%S')] Monitoring error:', error.message);
  process.exit(1);
});
" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Monitoring cycle finished"
