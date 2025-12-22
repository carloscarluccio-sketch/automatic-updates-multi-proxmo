import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import updateService from '../services/UpdateService';
import { logActivity } from '../utils/activityLogger';

/**
 * Check for available updates from Git repository
 */
export async function checkForUpdates(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Only super_admin can check for updates
    if (userRole !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super administrators can check for updates'
      });
      return;
    }

    const updateInfo = await updateService.checkForUpdates();

    await logActivity({
      userId: userId!,
      activityType: 'system_management',
      entityType: 'system_update',
      entityId: null,
      action: 'check_updates',
      description: `Checked for system updates - Current: ${updateInfo.currentVersion}, Latest: ${updateInfo.latestVersion}`,
      status: 'success',
      metadata: updateInfo as any,
      req
    });

    res.json({
      success: true,
      data: updateInfo
    });
  } catch (error: any) {
    console.error('Check updates error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check for updates'
    });
  }
}

/**
 * Get changelog for a specific version
 */
export async function getChangelog(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { version } = req.params;
    const userRole = req.user?.role;

    if (userRole !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super administrators can view changelogs'
      });
      return;
    }

    if (!version) {
      res.status(400).json({
        success: false,
        message: 'Version parameter is required'
      });
      return;
    }

    const changelog = await updateService.getChangelog(version);

    res.json({
      success: true,
      data: {
        version,
        changelog
      }
    });
  } catch (error: any) {
    console.error('Get changelog error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get changelog'
    });
  }
}

/**
 * Execute system update to target version
 */
export async function executeUpdate(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { targetVersion } = req.body;

    // Only super_admin can execute updates
    if (userRole !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super administrators can execute system updates'
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
      return;
    }

    if (!targetVersion) {
      res.status(400).json({
        success: false,
        message: 'Target version is required'
      });
      return;
    }

    // Log update initiation
    await logActivity({
      userId: userId,
      activityType: 'system_management',
      entityType: 'system_update',
      entityId: null,
      action: 'initiate_update',
      description: `Initiated system update to version ${targetVersion}`,
      status: 'in_progress',
      metadata: { targetVersion } as any,
      req
    });

    // Execute update (this may take several minutes)
    const result = await updateService.executeUpdate(targetVersion, userId);

    // Log completion
    await logActivity({
      userId: userId,
      activityType: 'system_management',
      entityType: 'system_update',
      entityId: result.updateId,
      action: 'complete_update',
      description: result.message,
      status: result.success ? 'success' : 'failed',
      metadata: result as any,
      req
    });

    res.json({
      success: result.success,
      message: result.message,
      data: {
        updateId: result.updateId
      }
    });
  } catch (error: any) {
    console.error('Execute update error:', error);

    // Log failure
    if (req.user?.id) {
      await logActivity({
        userId: req.user.id,
        activityType: 'system_management',
        entityType: 'system_update',
        entityId: null,
        action: 'update_failed',
        description: `System update failed: ${error.message}`,
        status: 'failed',
        metadata: { error: error.message } as any,
        req
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'System update failed'
    });
  }
}

/**
 * Rollback to previous version using backup
 */
export async function rollbackUpdate(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { updateId } = req.body;

    // Only super_admin can rollback updates
    if (userRole !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super administrators can rollback system updates'
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
      return;
    }

    if (!updateId) {
      res.status(400).json({
        success: false,
        message: 'Update ID is required'
      });
      return;
    }

    // Log rollback initiation
    await logActivity({
      userId: userId,
      activityType: 'system_management',
      entityType: 'system_update',
      entityId: updateId,
      action: 'initiate_rollback',
      description: `Initiated system rollback for update ${updateId}`,
      status: 'in_progress',
      metadata: { updateId } as any,
      req
    });

    // Execute rollback
    const result = await updateService.rollback(updateId, userId);

    // Log completion
    await logActivity({
      userId: userId,
      activityType: 'system_management',
      entityType: 'system_update',
      entityId: updateId,
      action: 'complete_rollback',
      description: result.message,
      status: result.success ? 'success' : 'failed',
      metadata: result as any,
      req
    });

    res.json({
      success: result.success,
      message: result.message
    });
  } catch (error: any) {
    console.error('Rollback error:', error);

    // Log failure
    if (req.user?.id) {
      await logActivity({
        userId: req.user.id,
        activityType: 'system_management',
        entityType: 'system_update',
        entityId: req.body.updateId,
        action: 'rollback_failed',
        description: `System rollback failed: ${error.message}`,
        status: 'failed',
        metadata: { error: error.message } as any,
        req
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'System rollback failed'
    });
  }
}

/**
 * Get update history
 */
export async function getUpdateHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userRole = req.user?.role;
    const limit = parseInt(req.query.limit as string) || 50;

    if (userRole !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super administrators can view update history'
      });
      return;
    }

    const history = await updateService.getUpdateHistory(limit);

    res.json({
      success: true,
      data: history
    });
  } catch (error: any) {
    console.error('Get update history error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get update history'
    });
  }
}

/**
 * Get current system information
 */
export async function getSystemInfo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userRole = req.user?.role;

    if (userRole !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super administrators can view system information'
      });
      return;
    }

    const systemInfo = await updateService.getSystemInfo();

    res.json({
      success: true,
      data: systemInfo
    });
  } catch (error: any) {
    console.error('Get system info error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get system information'
    });
  }
}
