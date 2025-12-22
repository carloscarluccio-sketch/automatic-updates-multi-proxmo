#!/bin/bash

# Deployment Script: Dev (192.168.142.237) to Production (98.142.209.206)
# Purpose: Deploy backend code changes from dev to production
# Usage: ./deploy_to_production.sh [--full|--quick|--workers-only]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Server details
DEV_SERVER="root@192.168.142.237"
PROD_SERVER="root@98.142.209.206"
BACKEND_PATH="/var/www/multpanelreact/backend"
TEMP_DIR="C:/tmp/deploy_$(date +%s)"

# Deployment mode (default: quick)
MODE="${1:-quick}"

echo -e "${GREEN}=== Proxmox Multi-Tenant Deployment Script ===${NC}"
echo -e "${YELLOW}Dev Server: ${DEV_SERVER}${NC}"
echo -e "${YELLOW}Production Server: ${PROD_SERVER}${NC}"
echo -e "${YELLOW}Mode: ${MODE}${NC}"
echo ""

# Create temp directory
mkdir -p "$TEMP_DIR"
echo -e "${GREEN}[1/7] Created temp directory: $TEMP_DIR${NC}"

# Function to deploy files
deploy_files() {
    local category=$1
    shift
    local files=("$@")

    echo -e "${YELLOW}Deploying ${category}...${NC}"

    for file in "${files[@]}"; do
        local filename=$(basename "$file")
        echo "  - Transferring $filename"

        # Download from dev
        scp "${DEV_SERVER}:${BACKEND_PATH}/${file}" "${TEMP_DIR}/" 2>/dev/null || {
            echo -e "${RED}    Failed to download $file${NC}"
            continue
        }

        # Upload to production
        ssh "$PROD_SERVER" "mkdir -p $(dirname ${BACKEND_PATH}/${file})" 2>/dev/null
        scp "${TEMP_DIR}/${filename}" "${PROD_SERVER}:${BACKEND_PATH}/${file}" 2>/dev/null || {
            echo -e "${RED}    Failed to upload $file${NC}"
            continue
        }

        echo -e "${GREEN}    ✓ ${filename}${NC}"
    done
}

# Step 2: Deploy based on mode
if [ "$MODE" == "full" ]; then
    echo -e "${GREEN}[2/7] Full deployment - transferring all files${NC}"

    # Core utilities
    deploy_files "Core Utilities" \
        "src/utils/activityLogger.ts"

    # Controllers
    deploy_files "Controllers" \
        "src/controllers/clusterScanController.ts" \
        "src/controllers/jobsController.ts"

    # Workers
    deploy_files "Workers" \
        "src/workers/index.ts" \
        "src/workers/isoScanWorker.ts" \
        "src/workers/templateScanWorker.ts" \
        "src/workers/esxiImportWorker.ts"

    # Config
    deploy_files "Configuration" \
        "src/config/queueConfig.ts" \
        "ecosystem.config.js"

    # Services
    deploy_files "Services" \
        "src/services/esxi/ProxmoxESXiImportService.ts"

    # Prisma schema
    deploy_files "Database Schema" \
        "prisma/schema.prisma"

elif [ "$MODE" == "workers-only" ]; then
    echo -e "${GREEN}[2/7] Workers-only deployment${NC}"

    deploy_files "Workers" \
        "src/workers/index.ts" \
        "src/workers/isoScanWorker.ts" \
        "src/workers/templateScanWorker.ts" \
        "src/workers/esxiImportWorker.ts"

else
    # Quick mode - only changed files
    echo -e "${GREEN}[2/7] Quick deployment - common updates${NC}"

    deploy_files "Controllers & Utils" \
        "src/utils/activityLogger.ts" \
        "src/controllers/clusterScanController.ts" \
        "src/controllers/jobsController.ts"
fi

# Step 3: Regenerate Prisma client (if schema changed)
if [ "$MODE" == "full" ]; then
    echo -e "${GREEN}[3/7] Regenerating Prisma client${NC}"
    ssh "$PROD_SERVER" "cd $BACKEND_PATH && npx prisma generate" || {
        echo -e "${RED}Failed to generate Prisma client${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}[3/7] Skipping Prisma generation (quick mode)${NC}"
fi

# Step 4: Install dependencies (if needed)
if [ "$MODE" == "full" ]; then
    echo -e "${GREEN}[4/7] Installing dependencies${NC}"
    ssh "$PROD_SERVER" "cd $BACKEND_PATH && npm install" || {
        echo -e "${RED}Failed to install dependencies${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}[4/7] Skipping npm install (quick mode)${NC}"
fi

# Step 5: Build TypeScript
echo -e "${GREEN}[5/7] Building TypeScript${NC}"
ssh "$PROD_SERVER" "cd $BACKEND_PATH && npm run build" || {
    echo -e "${RED}Build failed! Rolling back...${NC}"
    exit 1
}

# Step 6: Restart PM2 processes
echo -e "${GREEN}[6/7] Restarting PM2 processes${NC}"

if [ "$MODE" == "workers-only" ]; then
    ssh "$PROD_SERVER" "pm2 restart job-workers"
else
    ssh "$PROD_SERVER" "pm2 restart multpanel-api job-workers"
fi

echo -e "${GREEN}[7/7] Verifying deployment${NC}"
ssh "$PROD_SERVER" "pm2 list"

# Cleanup
rm -rf "$TEMP_DIR"
echo -e "${GREEN}Cleaned up temp directory${NC}"

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo -e "${YELLOW}Check logs: ssh $PROD_SERVER 'pm2 logs --lines 50'${NC}"
echo -e "${YELLOW}Check status: ssh $PROD_SERVER 'pm2 list'${NC}"
echo ""
