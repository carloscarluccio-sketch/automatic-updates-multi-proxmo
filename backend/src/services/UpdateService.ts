import { exec } from 'child_process';
import { promisify } from 'util';
import prisma from '../config/database';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export class UpdateService {
  private appDir = '/var/www/multpanelreact';
  private backupDir = '/root/backups';

  /**
   * Check for available updates from Git
   */
  async checkForUpdates(): Promise<{
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    versions: string[];
  }> {
    try {
      // Get current version from database
      const systemInfo = await prisma.system_info.findUnique({
        where: { id: 1 }
      });

      const currentVersion = systemInfo?.current_version || 'unknown';

      // Fetch latest tags from Git
      await execAsync(`cd ${this.appDir} && git fetch --tags origin 2>&1`);

      // Get all tags sorted by version (descending)
      const { stdout } = await execAsync(
        `cd ${this.appDir} && git tag -l --sort=-v:refname 2>&1`
      );

      const versions = stdout.trim().split('\n').filter(v => v && v.startsWith('v'));
      const latestVersion = versions[0] || currentVersion;

      return {
        currentVersion,
        latestVersion,
        updateAvailable: latestVersion !== currentVersion,
        versions: versions.slice(0, 20) // Last 20 versions
      };
    } catch (error: any) {
      logger.error('Check for updates error:', error);
      throw new Error(`Failed to check for updates: ${error.message}`);
    }
  }

  /**
   * Get changelog for a specific version
   */
  async getChangelog(version: string): Promise<string> {
    try {
      // Try to get CHANGELOG.md content for this version
      try {
        const { stdout } = await execAsync(
          `cd ${this.appDir} && git show ${version}:CHANGELOG.md 2>&1`
        );
        return stdout;
      } catch (e) {
        // If no CHANGELOG.md, get commit messages since previous tag
        const { stdout: prevTag } = await execAsync(
          `cd ${this.appDir} && git describe --tags --abbrev=0 ${version}^ 2>&1 || echo ""`
        );

        const range = prevTag.trim() ? `${prevTag.trim()}..${version}` : version;
        const { stdout: commits } = await execAsync(
          `cd ${this.appDir} && git log ${range} --pretty=format:"- %s (%an)" 2>&1 || echo "No changelog available"`
        );

        return commits || `Version ${version} - No detailed changelog available`;
      }
    } catch (error: any) {
      logger.error('Get changelog error:', error);
      return `Version ${version} - No changelog available`;
    }
  }

  /**
   * Execute system update
   */
  async executeUpdate(
    targetVersion: string,
    userId: number
  ): Promise<{
    success: boolean;
    message: string;
    updateId: number;
  }> {
    let updateRecord: any;

    try {
      // Get current version
      const systemInfo = await prisma.system_info.findUnique({
        where: { id: 1 }
      });

      const currentVersion = systemInfo?.current_version || 'unknown';

      // Don't allow updating to same version
      if (currentVersion === targetVersion) {
        throw new Error('Already on this version');
      }

      // Create update record
      updateRecord = await prisma.system_updates.create({
        data: {
          version_from: currentVersion,
          version_to: targetVersion,
    // @ts-ignore
          update_type: this.determineUpdateType(currentVersion, targetVersion),
          status: 'pending',
          initiated_by: userId
        }
      });

      logger.info(`Starting update from ${currentVersion} to ${targetVersion}`);

      // Update status to in_progress
      await prisma.system_updates.update({
        where: { id: updateRecord.id },
        data: { status: 'in_progress' }
      });

      const startTime = Date.now();

      // Step 1: Create backup
      logger.info('Step 1/6: Creating backup...');
      const backupFile = await this.createBackup();
      await prisma.system_updates.update({
        where: { id: updateRecord.id },
        data: { backup_file: backupFile }
      });

      // Step 2: Pull code and checkout version
      logger.info(`Step 2/6: Checking out version ${targetVersion}...`);
      await execAsync(`cd ${this.appDir} && git fetch --all --tags 2>&1`);
      await execAsync(`cd ${this.appDir} && git checkout tags/${targetVersion} 2>&1`);

      // Get git commit hash
      const { stdout: commitHash } = await execAsync(
        `cd ${this.appDir} && git rev-parse HEAD 2>&1`
      );

      // Step 3: Install backend dependencies
      logger.info('Step 3/6: Installing backend dependencies...');
      await execAsync(`cd ${this.appDir}/backend && npm install 2>&1`);

      // Step 4: Build backend
      logger.info('Step 4/6: Building backend...');
      await execAsync(`cd ${this.appDir}/backend && npm run build 2>&1`);

      // Step 5: Run database migrations
      logger.info('Step 5/6: Running database migrations...');
      try {
        await execAsync(`cd ${this.appDir}/backend && npx prisma migrate deploy 2>&1`);
      } catch (migError: any) {
        logger.warn('Migration warning (may be normal):', migError.message);
      }

      // Step 6: Restart services
      logger.info('Step 6/6: Restarting PM2 services...');
      await execAsync('pm2 restart all 2>&1');

      const duration = Math.floor((Date.now() - startTime) / 1000);

      // Update system info
      await prisma.system_info.update({
        where: { id: 1 },
        data: {
          current_version: targetVersion,
          git_commit_hash: commitHash.trim(),
          last_updated_at: new Date()
        }
      });

      // Mark update as completed
      await prisma.system_updates.update({
        where: { id: updateRecord.id },
        data: {
          status: 'completed',
          completed_at: new Date(),
          duration_seconds: duration,
          git_commit_hash: commitHash.trim()
        }
      });

      logger.info(`Update to ${targetVersion} completed successfully in ${duration}s`);

      return {
        success: true,
        message: `Successfully updated to ${targetVersion} in ${duration}s`,
        updateId: updateRecord.id
      };

    } catch (error: any) {
      logger.error('Update execution error:', error);

      if (updateRecord) {
        await prisma.system_updates.update({
          where: { id: updateRecord.id },
          data: {
            status: 'failed',
            error_message: error.message,
            completed_at: new Date()
          }
        });
      }

      throw new Error(`Update failed: ${error.message}`);
    }
  }

  /**
   * Rollback to previous version using backup
   */
  async rollback(updateId: number, _userId: number): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const update = await prisma.system_updates.findUnique({
        where: { id: updateId }
      });

      if (!update) {
        throw new Error('Update record not found');
      }

      if (!update.backup_file) {
        throw new Error('No backup file found for this update');
      }

      if (!fs.existsSync(update.backup_file)) {
        throw new Error('Backup file does not exist on disk');
      }

      logger.info(`Starting rollback from ${update.version_to} to ${update.version_from}`);

      // Stop services
      logger.info('Stopping PM2 services...');
      await execAsync('pm2 stop all 2>&1');

      // Restore backup
      logger.info(`Restoring backup from ${update.backup_file}...`);
      await execAsync(`tar -xzf ${update.backup_file} -C / 2>&1`);

      // Restart services
      logger.info('Restarting PM2 services...');
      await execAsync('pm2 restart all 2>&1');

      // Update system info
      await prisma.system_info.update({
        where: { id: 1 },
        data: {
          current_version: update.version_from,
          last_updated_at: new Date()
        }
      });

      // Mark update as rolled back
      await prisma.system_updates.update({
        where: { id: updateId },
        data: { status: 'rolled_back' }
      });

      logger.info(`Rollback to ${update.version_from} completed successfully`);

      return {
        success: true,
        message: `Successfully rolled back to ${update.version_from}`
      };

    } catch (error: any) {
      logger.error('Rollback error:', error);
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * Get update history
   */
  async getUpdateHistory(limit: number = 50) {
    return await prisma.system_updates.findMany({
      take: limit,
      orderBy: { started_at: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            first_name: true,
            last_name: true
          }
        }
      }
    });
  }

  /**
   * Get current system info
   */
  async getSystemInfo() {
    const info = await prisma.system_info.findUnique({
      where: { id: 1 }
    });

    return info;
  }

  /**
   * Create backup of current codebase
   */
  private async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + Date.now();
    const backupFile = path.join(this.backupDir, `backup_${timestamp}.tar.gz`);

    // Ensure backup directory exists
    await execAsync(`mkdir -p ${this.backupDir}`);

    // Create compressed backup (exclude node_modules for speed)
    await execAsync(
      `tar -czf ${backupFile} --exclude='node_modules' --exclude='dist' ${this.appDir} 2>&1`
    );

    logger.info(`Backup created: ${backupFile}`);

    // Clean up old backups (keep last 10)
    try {
      const { stdout } = await execAsync(
        `ls -t ${this.backupDir}/backup_*.tar.gz | tail -n +11`
      );

      const oldBackups = stdout.trim().split('\n').filter(f => f);
      for (const oldBackup of oldBackups) {
        await execAsync(`rm -f ${oldBackup}`);
        logger.info(`Deleted old backup: ${oldBackup}`);
      }
    } catch (e) {
      // Ignore cleanup errors
    }

    return backupFile;
  }

  /**
   * Determine update type based on version numbers
   */
  private determineUpdateType(from: string, to: string): string {
    try {
      // Remove 'v' prefix and split
      const fromParts = from.replace('v', '').split('.').map(Number);
      const toParts = to.replace('v', '').split('.').map(Number);

      // Major version change (1.x.x -> 2.x.x)
      if (fromParts[0] !== toParts[0]) return 'major';

      // Minor version change (1.1.x -> 1.2.x)
      if (fromParts[1] !== toParts[1]) return 'minor';

      // Patch version change (1.1.1 -> 1.1.2)
      return 'patch';
    } catch (e) {
      return 'patch';
    }
  }
}

export default new UpdateService();
