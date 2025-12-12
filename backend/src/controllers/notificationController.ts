import { Request, Response } from 'express';
import prisma from '../config/database';
import emailService from '../services/emailNotificationService';
import logger from '../utils/logger';

interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  companyId?: number | null;
}

/**
 * POST /api/notifications/test-smtp
 * Test SMTP connection (super_admin only)
 */
export const testSMTPConnection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userRole } = req;

    if (userRole !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super administrators can test SMTP connection',
      });
      return;
    }

    const result = await emailService.testConnection();

    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error: any) {
    logger.error('Error testing SMTP connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test SMTP connection',
    });
  }
};

/**
 * POST /api/notifications/send-test-email
 * Send a test email (super_admin only)
 */
export const sendTestEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userRole, userId } = req;
    const { recipient_email } = req.body;

    if (userRole !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super administrators can send test emails',
      });
      return;
    }

    if (!recipient_email) {
      res.status(400).json({
        success: false,
        message: 'recipient_email is required',
      });
      return;
    }

    const success = await emailService.sendEmail({
      to: recipient_email,
      subject: 'Test Email from Proxmox Multi-Tenant',
      html: `
        <h2>✅ Test Email Successful</h2>
        <p>This is a test email from your Proxmox Multi-Tenant platform.</p>
        <p><strong>SMTP Configuration:</strong> Working correctly</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          Sent at: ${new Date().toISOString()}<br>
          Sent by: User ID ${userId}
        </p>
      `,
      priority: 'normal',
    });

    if (success) {
      res.json({
        success: true,
        message: `Test email sent successfully to ${recipient_email}`,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test email. Check SMTP configuration.',
      });
    }
  } catch (error: any) {
    logger.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
    });
  }
};

/**
 * POST /api/notifications/process-queue
 * Manually trigger queue processing (super_admin only)
 */
export const processQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userRole } = req;

    if (userRole !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super administrators can manually process queue',
      });
      return;
    }

    // Process queue in background
    emailService.processQueue(100)
      .catch((error) => logger.error('Background queue processing error:', error));

    res.json({
      success: true,
      message: 'Email queue processing started in background',
    });
  } catch (error: any) {
    logger.error('Error starting queue processing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start queue processing',
    });
  }
};

/**
 * GET /api/notifications/queue
 * Get notification queue status
 */
export const getQueueStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userRole, companyId } = req;
    const { status, limit = 50, offset = 0 } = req.query;

    const where: any = {};

    // Company-specific filtering for non-super_admin
    if (userRole !== 'super_admin' && companyId) {
      const user = await prisma.users.findUnique({
        where: { id: req.userId },
        select: { company_id: true },
      });
      where.user_id = {
        in: await prisma.users.findMany({
          where: { company_id: user?.company_id },
          select: { id: true },
        }).then(users => users.map(u => u.id)),
      };
    }

    if (status) {
      where.status = status;
    }

    const [queueItems, totalCount, statusCounts] = await Promise.all([
      prisma.notification_queue.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { created_at: 'desc' },
        ],
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.notification_queue.count({ where }),
      prisma.notification_queue.groupBy({
        by: ['status'],
        _count: true,
        where: userRole !== 'super_admin' && companyId ? where : {},
      }),
    ]);

    const statusBreakdown = statusCounts.reduce((acc: any, item) => {
      if (item.status) {
        acc[item.status] = item._count;
      }
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        queue_items: queueItems,
        total_count: totalCount,
        status_breakdown: statusBreakdown,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error: any) {
    logger.error('Error fetching queue status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch queue status',
    });
  }
};

/**
 * GET /api/notifications/settings
 * Get notification settings for current user
 */
export const getNotificationSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req;

    const settings = await prisma.notification_settings.findMany({
      where: { user_id: userId },
    });

    res.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    logger.error('Error fetching notification settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification settings',
    });
  }
};

/**
 * POST /api/notifications/settings
 * Update notification settings for current user
 */
export const updateNotificationSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req;
    const { notification_type, email_enabled, webhook_url, webhook_enabled } = req.body;

    if (!notification_type) {
      res.status(400).json({
        success: false,
        message: 'notification_type is required',
      });
      return;
    }

    const setting = await prisma.notification_settings.upsert({
      where: {
        user_id_notification_type: {
          user_id: userId!,
          notification_type,
        },
      },
      update: {
        email_enabled: email_enabled !== undefined ? email_enabled : undefined,
        webhook_url: webhook_url !== undefined ? webhook_url : undefined,
        webhook_enabled: webhook_enabled !== undefined ? webhook_enabled : undefined,
      },
      create: {
        user_id: userId!,
        notification_type,
        email_enabled: email_enabled ?? true,
        webhook_url: webhook_url || null,
        webhook_enabled: webhook_enabled ?? false,
      },
    });

    res.json({
      success: true,
      data: setting,
      message: 'Notification settings updated successfully',
    });
  } catch (error: any) {
    logger.error('Error updating notification settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification settings',
    });
  }
};

/**
 * DELETE /api/notifications/queue/:id
 * Cancel a queued email (if still pending)
 */
export const cancelQueuedEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, userRole } = req;
    const { id } = req.params;

    const queueItem = await prisma.notification_queue.findUnique({
      where: { id: Number(id) },
    });

    if (!queueItem) {
      res.status(404).json({
        success: false,
        message: 'Queue item not found',
      });
      return;
    }

    // Permission check
    if (userRole !== 'super_admin' && queueItem.user_id !== userId) {
      res.status(403).json({
        success: false,
        message: 'You can only cancel your own queued emails',
      });
      return;
    }

    if (queueItem.status !== 'pending') {
      res.status(400).json({
        success: false,
        message: `Cannot cancel email with status: ${queueItem.status}`,
      });
      return;
    }

    await prisma.notification_queue.update({
      where: { id: Number(id) },
      data: {
        status: 'cancelled',
        error_message: 'Cancelled by user',
      },
    });

    res.json({
      success: true,
      message: 'Queued email cancelled successfully',
    });
  } catch (error: any) {
    logger.error('Error cancelling queued email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel queued email',
    });
  }
};

export default {
  testSMTPConnection,
  sendTestEmail,
  processQueue,
  getQueueStatus,
  getNotificationSettings,
  updateNotificationSettings,
  cancelQueuedEmail,
};
