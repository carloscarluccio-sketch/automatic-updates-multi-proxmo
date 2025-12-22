# Deployment Guide - Dev to Production

## Overview

This guide explains how to deploy code changes from the development server (192.168.142.237) to the production server (98.142.209.206).

## Quick Reference

### Deployment Modes

1. **Quick Mode** (Default) - Controllers and utilities only
   ```powershell
   .\deploy_to_production.ps1
   ```

2. **Full Mode** - All files, dependencies, and database schema
   ```powershell
   .\deploy_to_production.ps1 -Mode full
   ```

3. **Workers Only** - Just the background job workers
   ```powershell
   .\deploy_to_production.ps1 -Mode workers-only
   ```

## Server Details

| Server | IP | Purpose | Backend Port |
|--------|-----|---------|--------------|
| Dev | 192.168.142.237 | Development and testing | 5000 |
| Production | 98.142.209.206 | Live production server | 3001 |

## What Gets Deployed

### Quick Mode (Default)
- `src/utils/activityLogger.ts`
- `src/controllers/clusterScanController.ts`
- `src/controllers/jobsController.ts`

**Use when**: You've made changes to API endpoints or activity logging

**Time**: ~30 seconds

### Workers Only Mode
- `src/workers/index.ts`
- `src/workers/isoScanWorker.ts`
- `src/workers/templateScanWorker.ts`
- `src/workers/esxiImportWorker.ts`

**Use when**: You've modified background job processing logic

**Time**: ~45 seconds

### Full Mode
Everything:
- All controllers
- All workers
- All utilities
- Configuration files
- Database schema
- NPM dependencies

**Use when**:
- First time deployment
- Major changes across multiple components
- Database schema changes
- New dependencies added

**Time**: ~2-3 minutes

## Deployment Process

The script automatically performs these steps:

1. **Create Temp Directory** - Temporary storage for files during transfer
2. **Transfer Files** - SCP files from dev to temp, then temp to production
3. **Regenerate Prisma** (full mode) - Update database client
4. **Install Dependencies** (full mode) - Run npm install
5. **Build TypeScript** - Compile all .ts files to .js
6. **Restart PM2** - Restart API and/or workers
7. **Verify** - Show PM2 status

## Manual Deployment (Step-by-Step)

If you prefer to deploy manually or the script fails:

### Step 1: Transfer Files

```powershell
# From dev to local
scp root@192.168.142.237:/var/www/multpanelreact/backend/src/controllers/clusterScanController.ts C:/tmp/

# From local to production
scp C:/tmp/clusterScanController.ts root@98.142.209.206:/var/www/multpanelreact/backend/src/controllers/
```

### Step 2: Build on Production

```bash
ssh root@98.142.209.206
cd /var/www/multpanelreact/backend
npm run build
```

### Step 3: Restart PM2

```bash
pm2 restart multpanel-api job-workers
pm2 list
```

## Common Deployment Scenarios

### Scenario 1: Fixed a Bug in API Controller

```powershell
# Edit file on dev server
# Test on dev server
# Deploy to production
.\deploy_to_production.ps1
```

### Scenario 2: Updated Background Job Logic

```powershell
# Edit worker file on dev server
# Test job execution on dev
# Deploy to production
.\deploy_to_production.ps1 -Mode workers-only
```

### Scenario 3: Added New Database Table

```powershell
# Update Prisma schema on dev
# Run migration on dev
# Deploy to production
.\deploy_to_production.ps1 -Mode full

# Then run migration on production
ssh root@98.142.209.206
cd /var/www/multpanelreact/backend
npx prisma migrate deploy
```

### Scenario 4: Installed New NPM Package

```powershell
# Install package on dev
# Test on dev
# Deploy to production
.\deploy_to_production.ps1 -Mode full
```

## Rollback Procedure

If deployment causes issues:

### Quick Rollback (Last Commit)

```bash
ssh root@98.142.209.206
cd /var/www/multpanelreact/backend

# If using git
git checkout HEAD~1
npm run build
pm2 restart all

# If not using git
# Restore from backup (see below)
```

### Using Backups

Before deploying, create a backup:

```bash
ssh root@98.142.209.206
cd /var/www/multpanelreact/backend
tar -czf /root/backups/backend_$(date +%Y%m%d_%H%M%S).tar.gz src/ dist/

# Restore from backup
tar -xzf /root/backups/backend_YYYYMMDD_HHMMSS.tar.gz
npm run build
pm2 restart all
```

## Monitoring After Deployment

### Check PM2 Status

```bash
ssh root@98.142.209.206 'pm2 list'
```

Expected output:
```
┌────┬──────────────────┬─────────┬──────┬─────────┐
│ id │ name             │ status  │ cpu  │ memory  │
├────┼──────────────────┼─────────┼──────┼─────────┤
│ 0  │ multpanel-api    │ online  │ 0%   │ 340mb   │
│ 1  │ job-workers      │ online  │ 0%   │ 108mb   │
└────┴──────────────────┴─────────┴──────┴─────────┘
```

### Check Logs

```bash
# API logs
ssh root@98.142.209.206 'pm2 logs multpanel-api --lines 50'

# Worker logs
ssh root@98.142.209.206 'pm2 logs job-workers --lines 50'

# Both
ssh root@98.142.209.206 'pm2 logs --lines 30'
```

### Check Redis

```bash
ssh root@98.142.209.206 'redis-cli ping'
# Should return: PONG
```

### Check Database Connection

```bash
ssh root@98.142.209.206
cd /var/www/multpanelreact/backend
npx prisma db pull
# Should complete without errors
```

## Troubleshooting

### Build Fails

**Symptom**: TypeScript compilation errors

**Solution**:
1. Check error message for missing files
2. Ensure all dependencies are installed: `npm install`
3. Verify Prisma client is generated: `npx prisma generate`
4. Check for syntax errors in transferred files

### PM2 Won't Start

**Symptom**: Process shows "errored" status

**Solution**:
```bash
pm2 delete job-workers
pm2 start ecosystem.config.js --only job-workers
pm2 logs job-workers --err
```

### Redis Connection Failed

**Symptom**: Workers show Redis connection errors

**Solution**:
```bash
systemctl status redis-server
systemctl start redis-server
redis-cli ping
```

### Database Errors

**Symptom**: Prisma errors about missing tables/columns

**Solution**:
```bash
cd /var/www/multpanelreact/backend

# Check current schema
npx prisma db pull

# Compare with schema.prisma
diff prisma/schema.prisma <(npx prisma db pull)

# Run migrations
npx prisma migrate deploy
```

## Best Practices

1. **Always Test on Dev First**
   - Never deploy untested code
   - Test all affected features
   - Check logs for errors

2. **Use Version Control**
   - Commit changes before deploying
   - Tag production releases
   - Keep commit messages clear

3. **Deploy During Low Traffic**
   - Avoid peak hours
   - Inform users of maintenance if needed
   - Monitor after deployment

4. **Create Backups**
   - Backup before major changes
   - Keep last 3-5 backups
   - Document restore procedure

5. **Monitor After Deployment**
   - Check PM2 status
   - Review logs for errors
   - Test critical features
   - Monitor resource usage

## File Structure

```
C:\Users\Usuario\
├── deploy_to_production.ps1    # PowerShell deployment script
├── deploy_to_production.sh     # Bash deployment script (optional)
└── DEPLOYMENT_GUIDE.md         # This file
```

## Quick Commands Reference

```powershell
# Quick deploy
.\deploy_to_production.ps1

# Full deploy
.\deploy_to_production.ps1 -Mode full

# Workers only
.\deploy_to_production.ps1 -Mode workers-only

# Check production status
ssh root@98.142.209.206 'pm2 list'

# View production logs
ssh root@98.142.209.206 'pm2 logs --lines 50'

# Restart all services
ssh root@98.142.209.206 'pm2 restart all'

# Check Redis
ssh root@98.142.209.206 'redis-cli ping'
```

## Support

If you encounter issues:

1. Check logs: `pm2 logs --lines 100`
2. Verify services: `pm2 list`
3. Check Redis: `redis-cli ping`
4. Review error messages
5. Rollback if necessary

## Changelog

- **2025-12-21**: Initial deployment guide created
  - Background jobs system deployed
  - Activity logging integrated
  - Deployment scripts created

---

**Last Updated**: December 21, 2025
**Status**: Production deployment successful
