#!/bin/bash
# NAT Auto-Deploy Script
# Automatically deploys pending NAT rules with auto_apply enabled
# Runs every 5 minutes via cron

cd /var/www/multpanelreact/backend || exit 1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting NAT auto-deploy cycle..."

node -e "
const { deployPendingNATRules } = require('./dist/services/natDeploymentService');

deployPendingNATRules()
.then(() => {
  console.log('[$(date '+%Y-%m-%d %H:%M:%S')] NAT auto-deploy cycle complete');
  process.exit(0);
})
.catch((error) => {
  console.error('[$(date '+%Y-%m-%d %H:%M:%S')] NAT auto-deploy error:', error.message);
  process.exit(1);
});
" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] NAT auto-deploy finished"
