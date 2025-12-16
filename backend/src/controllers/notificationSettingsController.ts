import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Get user's notification settings
 * GET /api/notification-settings
 */
export const getNotificationSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    const settings = await prisma.notification_settings.findMany({
      where: { user_id: user.id },
      orderBy: { notification_type: 'asc' }
    });

    // If no settings exist, create default settings for common notification types
    if (settings.length === 0) {
      const defaultTypes = [
        'ticket_created',
        'ticket_message',
        'ticket_status_change',
        'vm_created',
        'vm_status_change',
        'vm_deleted',
        'user_created',
        'user_updated',
        'subscription_expiring',
        'subscription_expired',
        'webhook_failed',
        'rate_limit_exceeded'
      ];

      const defaultSettings = await Promise.all(
        defaultTypes.map(type =>
          prisma.notification_settings.create({
            data: {
              user_id: user.id,
              notification_type: type,
              email_enabled: true,
              webhook_enabled: false
            }
          })
        )
      );

      res.json({ success: true, data: defaultSettings });
    } else {
      res.json({ success: true, data: settings });
    }
  } catch (error: any) {
    logger.error('Get notification settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notification settings' });
  }
};

/**
 * Update notification setting
 * PATCH /api/notification-settings/:id
 */
export const updateNotificationSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const settingId = parseInt(req.params.id);
    const { email_enabled, webhook_enabled, webhook_url } = req.body;

    // Check if setting belongs to user
    const existing = await prisma.notification_settings.findUnique({
      where: { id: settingId }
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Notification setting not found' });
      return;
    }

    if (existing.user_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Validate webhook URL if webhook is enabled
    if (webhook_enabled && webhook_url) {
      try {
        new URL(webhook_url);
      } catch {
        res.status(400).json({ success: false, message: 'Invalid webhook URL' });
        return;
      }
    }

    const updateData: any = {};
    if (email_enabled !== undefined) updateData.email_enabled = email_enabled;
    if (webhook_enabled !== undefined) updateData.webhook_enabled = webhook_enabled;
    if (webhook_url !== undefined) updateData.webhook_url = webhook_url || null;

    const setting = await prisma.notification_settings.update({
      where: { id: settingId },
      data: updateData
    });

    logger.info(`User ${user.id} updated notification setting ${settingId}`);
    res.json({ success: true, data: setting });
  } catch (error: any) {
    logger.error('Update notification setting error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notification setting' });
  }
};

/**
 * Bulk update notification settings
 * POST /api/notification-settings/bulk
 */
export const bulkUpdateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { settings } = req.body;

    if (!Array.isArray(settings)) {
      res.status(400).json({ success: false, message: 'Settings must be an array' });
      return;
    }

    // Verify all settings belong to user
    const settingIds = settings.map(s => s.id);
    const existingSettings = await prisma.notification_settings.findMany({
      where: {
        id: { in: settingIds },
        user_id: user.id
      }
    });

    if (existingSettings.length !== settings.length) {
      res.status(403).json({ success: false, message: 'One or more settings not found or access denied' });
      return;
    }

    // Update all settings
    const updates = await Promise.all(
      settings.map(setting =>
        prisma.notification_settings.update({
          where: { id: setting.id },
          data: {
            email_enabled: setting.email_enabled,
            webhook_enabled: setting.webhook_enabled,
            webhook_url: setting.webhook_url || null
          }
        })
      )
    );

    logger.info(`User ${user.id} bulk updated ${updates.length} notification settings`);
    res.json({ success: true, data: updates });
  } catch (error: any) {
    logger.error('Bulk update notification settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notification settings' });
  }
};

/**
 * Toggle all email notifications
 * POST /api/notification-settings/toggle-all-email
 */
export const toggleAllEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { enabled } = req.body;

    if (enabled === undefined) {
      res.status(400).json({ success: false, message: 'enabled field is required' });
      return;
    }

    await prisma.notification_settings.updateMany({
      where: { user_id: user.id },
      data: { email_enabled: enabled }
    });

    const updatedSettings = await prisma.notification_settings.findMany({
      where: { user_id: user.id }
    });

    logger.info(`User ${user.id} toggled all email notifications to ${enabled}`);
    res.json({ success: true, data: updatedSettings });
  } catch (error: any) {
    logger.error('Toggle all email error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle email notifications' });
  }
};

/**
 * Get notification categories with counts
 * GET /api/notification-settings/categories
 */
export const getNotificationCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    const settings = await prisma.notification_settings.findMany({
      where: { user_id: user.id }
    });

    // Group by category
    const categories = {
      tickets: settings.filter(s => s.notification_type.startsWith('ticket_')),
      vms: settings.filter(s => s.notification_type.startsWith('vm_')),
      users: settings.filter(s => s.notification_type.startsWith('user_')),
      subscriptions: settings.filter(s => s.notification_type.startsWith('subscription_')),
      system: settings.filter(s => ['webhook_failed', 'rate_limit_exceeded'].includes(s.notification_type))
    };

    const summary = {
      tickets: {
        total: categories.tickets.length,
        email_enabled: categories.tickets.filter(s => s.email_enabled).length,
        webhook_enabled: categories.tickets.filter(s => s.webhook_enabled).length
      },
      vms: {
        total: categories.vms.length,
        email_enabled: categories.vms.filter(s => s.email_enabled).length,
        webhook_enabled: categories.vms.filter(s => s.webhook_enabled).length
      },
      users: {
        total: categories.users.length,
        email_enabled: categories.users.filter(s => s.email_enabled).length,
        webhook_enabled: categories.users.filter(s => s.webhook_enabled).length
      },
      subscriptions: {
        total: categories.subscriptions.length,
        email_enabled: categories.subscriptions.filter(s => s.email_enabled).length,
        webhook_enabled: categories.subscriptions.filter(s => s.webhook_enabled).length
      },
      system: {
        total: categories.system.length,
        email_enabled: categories.system.filter(s => s.email_enabled).length,
        webhook_enabled: categories.system.filter(s => s.webhook_enabled).length
      }
    };

    res.json({ success: true, data: { categories, summary } });
  } catch (error: any) {
    logger.error('Get notification categories error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notification categories' });
  }
};

export default {
  getNotificationSettings,
  updateNotificationSetting,
  bulkUpdateSettings,
  toggleAllEmail,
  getNotificationCategories
};
