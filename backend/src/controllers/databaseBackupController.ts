import { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

const BACKUP_DIR = '/var/backups/mysql/multpanel';
const BACKUP_SCRIPT = '/var/www/multpanelreact/scripts/backup_database.sh';

/**
 * List all database backups
 */
export const listBackups = async (_req: Request, res: Response): Promise<void> => {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    
    const backups = await Promise.all(
      files
        .filter(f => f.endsWith('.sql.gz') && f !== 'latest.sql.gz')
        .map(async (filename) => {
          const filePath = path.join(BACKUP_DIR, filename);
          const stats = await fs.stat(filePath);
          
          return {
            filename,
            size: stats.size,
            sizeFormatted: formatBytes(stats.size),
            created: stats.mtime,
            path: filePath
          };
        })
    );

    // Sort by date, newest first
    backups.sort((a, b) => b.created.getTime() - a.created.getTime());

    res.json({
      success: true,
      data: {
        backups,
        totalBackups: backups.length,
        totalSize: backups.reduce((sum, b) => sum + b.size, 0),
        backupDirectory: BACKUP_DIR
      }
    });
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list backups'
    });
  }
};

/**
 * Trigger manual backup
 */
export const triggerBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user is super_admin
    const user = (req as any).user;
    if (user?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super admins can trigger manual backups'
      });
      return;
    }

    // Execute backup script
    const { stdout, stderr } = await execAsync(BACKUP_SCRIPT);

    res.json({
      success: true,
      message: 'Database backup completed successfully',
      output: stdout,
      warnings: stderr || undefined
    });
  } catch (error: any) {
    console.error('Trigger backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Backup failed',
      error: error.message,
      stderr: error.stderr
    });
  }
};

/**
 * Delete old backup
 */
export const deleteBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    // Security: prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
      res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
      return;
    }

    // Check if user is super_admin
    const user = (req as any).user;
    if (user?.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super admins can delete backups'
      });
      return;
    }

    // Don't allow deleting the latest symlink
    if (filename === 'latest.sql.gz') {
      res.status(400).json({
        success: false,
        message: 'Cannot delete the latest backup symlink'
      });
      return;
    }

    const filePath = path.join(BACKUP_DIR, filename);
    
    // Verify file exists and is in backup directory
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      res.status(400).json({
        success: false,
        message: 'Not a valid backup file'
      });
      return;
    }

    await fs.unlink(filePath);

    res.json({
      success: true,
      message: 'Backup deleted successfully',
      filename
    });
  } catch (error: any) {
    console.error('Delete backup error:', error);
    res.status(500).json({
      success: false,
      message: error.code === 'ENOENT' ? 'Backup file not found' : 'Failed to delete backup'
    });
  }
};

/**
 * Download backup file
 */
export const downloadBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    // Security: prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
      res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
      return;
    }

    const filePath = path.join(BACKUP_DIR, filename);
    
    // Verify file exists
    await fs.access(filePath);

    res.download(filePath, filename);
  } catch (error: any) {
    console.error('Download backup error:', error);
    res.status(404).json({
      success: false,
      message: 'Backup file not found'
    });
  }
};

/**
 * Helper: Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
