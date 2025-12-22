# Deployment Script: Dev to Production (PowerShell)
# Purpose: Deploy backend code changes from dev (192.168.142.237) to production (98.142.209.206)
# Usage: .\deploy_to_production.ps1 [-Mode full|quick|workers-only]

param(
    [ValidateSet("full", "quick", "workers-only")]
    [string]$Mode = "quick"
)

$DEV_SERVER = "root@192.168.142.237"
$PROD_SERVER = "root@98.142.209.206"
$BACKEND_PATH = "/var/www/multpanelreact/backend"
$TEMP_DIR = "C:\tmp\deploy_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

Write-Host "=== Proxmox Multi-Tenant Deployment Script ===" -ForegroundColor Green
Write-Host "Dev Server: $DEV_SERVER" -ForegroundColor Yellow
Write-Host "Production Server: $PROD_SERVER" -ForegroundColor Yellow
Write-Host "Mode: $Mode" -ForegroundColor Yellow
Write-Host ""

# Create temp directory
New-Item -ItemType Directory -Force -Path $TEMP_DIR | Out-Null
Write-Host "[1/7] Created temp directory: $TEMP_DIR" -ForegroundColor Green

# Function to deploy files
function Deploy-Files {
    param(
        [string]$Category,
        [string[]]$Files
    )

    Write-Host "Deploying $Category..." -ForegroundColor Yellow

    foreach ($file in $Files) {
        $filename = Split-Path $file -Leaf
        Write-Host "  - Transferring $filename"

        # Download from dev
        $devPath = "${DEV_SERVER}:${BACKEND_PATH}/${file}"
        $localPath = Join-Path $TEMP_DIR $filename
        $prodPath = "${PROD_SERVER}:${BACKEND_PATH}/${file}"

        try {
            & scp $devPath $localPath 2>&1 | Out-Null

            # Create directory on production
            $dirPath = Split-Path "${BACKEND_PATH}/${file}" -Parent
            & ssh $PROD_SERVER "mkdir -p $dirPath" 2>&1 | Out-Null

            # Upload to production
            & scp $localPath $prodPath 2>&1 | Out-Null

            Write-Host "    ✓ $filename" -ForegroundColor Green
        }
        catch {
            Write-Host "    ✗ Failed to transfer $filename" -ForegroundColor Red
        }
    }
}

# Step 2: Deploy based on mode
if ($Mode -eq "full") {
    Write-Host "[2/7] Full deployment - transferring all files" -ForegroundColor Green

    Deploy-Files "Core Utilities" @(
        "src/utils/activityLogger.ts"
    )

    Deploy-Files "Controllers" @(
        "src/controllers/clusterScanController.ts",
        "src/controllers/jobsController.ts"
    )

    Deploy-Files "Workers" @(
        "src/workers/index.ts",
        "src/workers/isoScanWorker.ts",
        "src/workers/templateScanWorker.ts",
        "src/workers/esxiImportWorker.ts"
    )

    Deploy-Files "Configuration" @(
        "src/config/queueConfig.ts",
        "ecosystem.config.js"
    )

    Deploy-Files "Services" @(
        "src/services/esxi/ProxmoxESXiImportService.ts"
    )

    Deploy-Files "Database Schema" @(
        "prisma/schema.prisma"
    )
}
elseif ($Mode -eq "workers-only") {
    Write-Host "[2/7] Workers-only deployment" -ForegroundColor Green

    Deploy-Files "Workers" @(
        "src/workers/index.ts",
        "src/workers/isoScanWorker.ts",
        "src/workers/templateScanWorker.ts",
        "src/workers/esxiImportWorker.ts"
    )
}
else {
    Write-Host "[2/7] Quick deployment - common updates" -ForegroundColor Green

    Deploy-Files "Controllers & Utils" @(
        "src/utils/activityLogger.ts",
        "src/controllers/clusterScanController.ts",
        "src/controllers/jobsController.ts"
    )
}

# Step 3: Regenerate Prisma client (if schema changed)
if ($Mode -eq "full") {
    Write-Host "[3/7] Regenerating Prisma client" -ForegroundColor Green
    & ssh $PROD_SERVER "cd $BACKEND_PATH && npx prisma generate"
}
else {
    Write-Host "[3/7] Skipping Prisma generation (quick mode)" -ForegroundColor Yellow
}

# Step 4: Install dependencies (if needed)
if ($Mode -eq "full") {
    Write-Host "[4/7] Installing dependencies" -ForegroundColor Green
    & ssh $PROD_SERVER "cd $BACKEND_PATH && npm install"
}
else {
    Write-Host "[4/7] Skipping npm install (quick mode)" -ForegroundColor Yellow
}

# Step 5: Build TypeScript
Write-Host "[5/7] Building TypeScript" -ForegroundColor Green
$buildResult = & ssh $PROD_SERVER "cd $BACKEND_PATH && npm run build 2>&1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed! Output:" -ForegroundColor Red
    Write-Host $buildResult
    exit 1
}

# Step 6: Restart PM2 processes
Write-Host "[6/7] Restarting PM2 processes" -ForegroundColor Green

if ($Mode -eq "workers-only") {
    & ssh $PROD_SERVER "pm2 restart job-workers"
}
else {
    & ssh $PROD_SERVER "pm2 restart multpanel-api job-workers"
}

# Step 7: Verify deployment
Write-Host "[7/7] Verifying deployment" -ForegroundColor Green
& ssh $PROD_SERVER "pm2 list"

# Cleanup
Remove-Item -Recurse -Force $TEMP_DIR
Write-Host "Cleaned up temp directory" -ForegroundColor Green

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host "Check logs: ssh $PROD_SERVER 'pm2 logs --lines 50'" -ForegroundColor Yellow
Write-Host "Check status: ssh $PROD_SERVER 'pm2 list'" -ForegroundColor Yellow
Write-Host ""
