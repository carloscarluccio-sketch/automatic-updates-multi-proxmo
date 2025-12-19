import { Request, Response } from 'express';
import database from '../config/database';
import { emailProcessor } from '../services/emailProcessorService';
import logger from '../utils/logger';

/**
 * Get SMTP settings
 */
export const getSMTPSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await database.global_settings.findFirst({
      where: { setting_key: 'smtp_config' }
    });

    if (!settings || !settings.setting_value_json) {
      res.json({
        success: true,
        data: null
      });
    }

    const config = JSON.parse(settings!.setting_value_json as string);

    // Don't send password to frontend
    delete config.password;

    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    logger.error('Error getting SMTP settings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get SMTP settings'
    });
  }
};

/**
 * Update SMTP settings
 */
export const updateSMTPSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { host, port, secure, username, password } = req.body;

    // Validate required fields
    if (!host || !port || !username) {
      void res.status(400).json({
        success: false,
        message: 'Missing required SMTP settings (host, port, username)'
      });
    }

    // Get existing config to preserve password if not provided
    let finalPassword = password;
    if (!password) {
      const existingSettings = await database.global_settings.findFirst({
        where: { setting_key: 'smtp_config' }
      });
      if (existingSettings && existingSettings.setting_value_json) {
        const existingConfig = JSON.parse(existingSettings.setting_value_json as string);
        finalPassword = existingConfig.password;
      }
    }

    if (!finalPassword) {
      void res.status(400).json({
        success: false,
        message: 'Password is required for new SMTP configuration'
      });
    }

    const config = {
      host,
      port: parseInt(port),
      secure: secure || false,
      username,
      password: finalPassword
    };

    // Save to database
    await database.global_settings.upsert({
      where: { setting_key: 'smtp_config' },
      update: {
        setting_value_json: JSON.stringify(config),
        updated_at: new Date()
      },
      create: {
        setting_key: 'smtp_config',
        setting_value_json: JSON.stringify(config),
        description: 'SMTP server configuration for email sending'
      }
    });

    logger.info('SMTP settings updated successfully');

    res.json({
      success: true,
      message: 'SMTP settings saved successfully'
    });
  } catch (error: any) {
    logger.error('Error updating SMTP settings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update SMTP settings'
    });
  }
};

/**
 * Test SMTP connection
 */
export const testSMTPConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { host, port, secure, username, password } = req.body;

    if (!host || !port || !username || !password) {
      void res.status(400).json({
        success: false,
        message: 'All SMTP fields are required for connection test'
      });
    }

    const config = {
      host,
      port: parseInt(port),
      secure: secure || false,
      auth: {
        user: username,
        pass: password
      }
    };

    const result = await emailProcessor.testSMTPConnection(config);

    res.json({
      success: result.success,
      message: result.message
    });
  } catch (error: any) {
    logger.error('Error testing SMTP connection:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to test SMTP connection'
    });
  }
};

/**
 * Get email queue status and statistics
 */
export const getEmailQueueStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get counts by status
    const stats = await database.email_queue.groupBy({
      by: ['status'],
      _count: true
    });

    const statusCounts = {
      pending: 0,
      sending: 0,
      sent: 0,
      failed: 0,
      cancelled: 0
    };

    stats.forEach((stat: any) => {
      if (statusCounts.hasOwnProperty(stat.status)) {
        statusCounts[stat.status as keyof typeof statusCounts] = stat._count;
      }
    });

    // Get recent activity (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentSent = await database.email_queue.count({
      where: {
        status: 'sent',
        sent_at: { gte: oneDayAgo }
      }
    });

    const recentFailed = await database.email_queue.count({
      where: {
        status: 'failed',
        created_at: { gte: oneDayAgo }
      }
    });

    // Get recent emails (last 10)
    const recentEmails = await database.email_queue.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        id: true,
        recipient_email: true,
        subject: true,
        status: true,
        created_at: true,
        sent_at: true,
        error_message: true
      }
    });

    res.json({
      success: true,
      data: {
        statusCounts,
        recentActivity: {
          sent24h: recentSent,
          failed24h: recentFailed
        },
        recentEmails
      }
    });
  } catch (error: any) {
    logger.error('Error getting email queue status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get email queue status'
    });
  }
};

/**
 * Process email queue manually (trigger immediate processing)
 */
export const processEmailQueueManually = async (_req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Manual email queue processing triggered');

    const result = await emailProcessor.processEmailQueue();

    res.json({
      success: true,
      data: result,
      message: `Processed ${result.processed} emails: ${result.sent} sent, ${result.failed} failed`
    });
  } catch (error: any) {
    logger.error('Error processing email queue:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process email queue'
    });
  }
};

/**
 * Get default email sender settings
 */
export const getEmailFromSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await database.global_settings.findFirst({
      where: { setting_key: 'email_from_default' }
    });

    if (!settings || !settings.setting_value_json) {
      void res.json({
        success: true,
        data: {
          email: 'noreply@proxmox-multi-tenant.local',
          name: 'Proxmox Multi-Tenant'
        }
      });
    }

    const config = JSON.parse(settings!.setting_value_json as string);

    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    logger.error('Error getting email from settings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get email from settings'
    });
  }
};

/**
 * Update default email sender settings
 */
export const updateEmailFromSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      void res.status(400).json({
        success: false,
        message: 'Email and name are required'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      void res.status(400).json({
        success: false,
        message: 'Invalid email address format'
      });
    }

    const config = { email, name };

    await database.global_settings.upsert({
      where: { setting_key: 'email_from_default' },
      update: {
        setting_value_json: JSON.stringify(config),
        updated_at: new Date()
      },
      create: {
        setting_key: 'email_from_default',
        setting_value_json: JSON.stringify(config),
        description: 'Default from email and name for system emails'
      }
    });

    logger.info('Email from settings updated successfully');

    res.json({
      success: true,
      message: 'Email from settings saved successfully'
    });
  } catch (error: any) {
    logger.error('Error updating email from settings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update email from settings'
    });
  }
};

/**
 * Retry failed emails
 */
export const retryFailedEmails = async (_req: Request, res: Response): Promise<void> => {
  try {
    const count = await emailProcessor.retryFailedEmails();

    res.json({
      success: true,
      data: { count },
      message: `Reset ${count} failed emails for retry`
    });
  } catch (error: any) {
    logger.error('Error retrying failed emails:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retry failed emails'
    });
  }
};

/**
 * Clean up old emails
 */
export const cleanupOldEmails = async (_req: Request, res: Response): Promise<void> => {
  try {
    const count = await emailProcessor.cleanupOldEmails();

    res.json({
      success: true,
      data: { count },
      message: `Cleaned up ${count} old emails`
    });
  } catch (error: any) {
    logger.error('Error cleaning up old emails:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to clean up old emails'
    });
  }
};

/**
 * Send test email
 */
export const sendTestEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { recipient } = req.body;

    if (!recipient) {
      void res.status(400).json({
        success: false,
        message: 'Recipient email is required'
      });
    }

    // Queue a test email
    const emailId = await database.email_queue.create({
      data: {
        recipient_email: recipient,
        recipient_name: 'Test Recipient',
        subject: 'Test Email from Proxmox Multi-Tenant',
        body_html: `
          <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Test Email</h2>
              <p>This is a test email from your Proxmox Multi-Tenant platform.</p>
              <p>If you received this email, your SMTP configuration is working correctly!</p>
              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                Sent at: ${new Date().toISOString()}
              </p>
            </body>
          </html>
        `,
        body_text: 'This is a test email from your Proxmox Multi-Tenant platform. If you received this email, your SMTP configuration is working correctly!',
        status: 'pending',
        priority: 1 // High priority
      }
    });

    // Trigger immediate processing
    const result = await emailProcessor.processEmailQueue();

    res.json({
      success: true,
      message: 'Test email queued and processing started',
      data: { emailId: emailId.id, processed: result.processed }
    });
  } catch (error: any) {
    logger.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send test email'
    });
  }
};
