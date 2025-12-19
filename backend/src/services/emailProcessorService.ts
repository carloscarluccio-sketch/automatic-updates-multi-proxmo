import nodemailer from 'nodemailer';
import database from '../config/database';
import logger from '../utils/logger';

interface EmailQueueItem {
  id: number;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body_html: string;
  body_text: string | null;
  from_email: string | null;
  from_name: string | null;
  reply_to: string | null;
  cc: string | null;
  bcc: string | null;
  status: string;
  retry_count: number;
  max_retries: number;
  attachments: any;
}

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

class EmailProcessorService {
  private transporter: nodemailer.Transporter | null = null;

  /**
   * Get SMTP configuration from database or environment
   */
  async getSMTPConfig(): Promise<SMTPConfig | null> {
    try {
      // Try to get from database first
      const config = await database.global_settings.findFirst({
        where: { setting_key: 'smtp_config' }
      });

      if (config && config.setting_value_text) {
        const smtpSettings = JSON.parse(config.setting_value_text as string);
        return {
          host: smtpSettings.host,
          port: smtpSettings.port || 587,
          secure: smtpSettings.secure || false,
          auth: {
            user: smtpSettings.username,
            pass: smtpSettings.password
          }
        };
      }

      // Fallback to environment variables
      if (process.env.SMTP_HOST) {
        return {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || ''
          }
        };
      }

      logger.warn('No SMTP configuration found');
      return null;
    } catch (error) {
      logger.error('Error getting SMTP config:', error);
      return null;
    }
  }

  /**
   * Initialize email transporter
   */
  async initializeTransporter(): Promise<boolean> {
    try {
      const config = await this.getSMTPConfig();
      if (!config) {
        logger.error('Cannot initialize transporter: No SMTP config');
        return false;
      }

      this.transporter = nodemailer.createTransport(config);

      // Verify connection
      await this.transporter.verify();
      logger.info('Email transporter initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
      this.transporter = null;
      return false;
    }
  }

  /**
   * Test SMTP connection
   */
  async testSMTPConnection(config?: SMTPConfig): Promise<{ success: boolean; message: string }> {
    try {
      const testConfig = config || await this.getSMTPConfig();
      if (!testConfig) {
        return { success: false, message: 'No SMTP configuration provided' };
      }

      const testTransporter = nodemailer.createTransport(testConfig);
      await testTransporter.verify();

      return { success: true, message: 'SMTP connection successful' };
    } catch (error: any) {
      logger.error('SMTP connection test failed:', error);
      return { success: false, message: error.message || 'Connection failed' };
    }
  }

  /**
   * Send a single email from queue
   */
  async sendEmail(queueItem: EmailQueueItem): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.transporter) {
        const initialized = await this.initializeTransporter();
        if (!initialized) {
          throw new Error('Email transporter not initialized');
        }
      }

      const mailOptions: nodemailer.SendMailOptions = {
        from: queueItem.from_name
          ? `"${queueItem.from_name}" <${queueItem.from_email || 'noreply@proxmox-multi-tenant.local'}>`
          : queueItem.from_email || 'noreply@proxmox-multi-tenant.local',
        to: queueItem.recipient_name
          ? `"${queueItem.recipient_name}" <${queueItem.recipient_email}>`
          : queueItem.recipient_email,
        subject: queueItem.subject,
        html: queueItem.body_html,
        text: queueItem.body_text || undefined,
        replyTo: queueItem.reply_to || undefined,
        cc: queueItem.cc || undefined,
        bcc: queueItem.bcc || undefined
      };

      // Add attachments if any
      if (queueItem.attachments) {
        try {
          const attachments = typeof queueItem.attachments === 'string'
            ? JSON.parse(queueItem.attachments)
            : queueItem.attachments;

          if (Array.isArray(attachments) && attachments.length > 0) {
            mailOptions.attachments = attachments;
          }
        } catch (e) {
          logger.warn('Failed to parse attachments for email', queueItem.id);
        }
      }

      await this.transporter!.sendMail(mailOptions);
      logger.info(`Email sent successfully: ${queueItem.id} to ${queueItem.recipient_email}`);

      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to send email ${queueItem.id}:`, error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Process email queue - send pending emails
   */
  async processEmailQueue(): Promise<{ processed: number; sent: number; failed: number }> {
    let processed = 0;
    let sent = 0;
    let failed = 0;

    try {
      // Get pending emails sorted by priority (lower number = higher priority) and scheduled time
      const pendingEmails = await database.email_queue.findMany({
        where: {
          status: 'pending',
          OR: [
            { scheduled_at: null },
            { scheduled_at: { lte: new Date() } }
          ]
        },
        orderBy: [
          { priority: 'asc' },
          { created_at: 'asc' }
        ],
        take: 50 // Process max 50 emails per batch
      });

      logger.info(`Processing ${pendingEmails.length} pending emails`);

      for (const email of pendingEmails) {
        processed++;

        // Update status to 'sending'
        await database.email_queue.update({
          where: { id: email.id },
          data: { status: 'sending' }
        });

        // Send email
        const result = await this.sendEmail(email as any);

        if (result.success) {
          // Mark as sent
          await database.email_queue.update({
            where: { id: email.id },
            data: {
              status: 'sent',
              sent_at: new Date()
            }
          });
          sent++;
        } else {
          // Handle failure
          const newRetryCount = (email.retry_count || 0) + 1;
          const shouldRetry = newRetryCount < (email.max_retries || 3);

          if (shouldRetry) {
            // Calculate next retry time (exponential backoff)
            const retryDelayMinutes = Math.pow(2, newRetryCount) * 5; // 5, 10, 20, 40 minutes
            const nextRetry = new Date(Date.now() + retryDelayMinutes * 60 * 1000);

            await database.email_queue.update({
              where: { id: email.id },
              data: {
                status: 'pending',
                retry_count: newRetryCount,
                last_retry_at: new Date(),
                next_retry_at: nextRetry,
                error_message: result.error || 'Send failed'
              }
            });

            logger.info(`Email ${email.id} will retry ${(email.max_retries || 3) - newRetryCount} more time(s), next at ${nextRetry.toISOString()}`);
          } else {
            // Max retries exceeded
            await database.email_queue.update({
              where: { id: email.id },
              data: {
                status: 'failed',
                error_message: result.error || 'Max retries exceeded'
              }
            });

            logger.error(`Email ${email.id} failed permanently after ${(email.max_retries || 3)} retries`);
          }
          failed++;
        }
      }

      logger.info(`Email processing complete: ${processed} processed, ${sent} sent, ${failed} failed`);
      return { processed, sent, failed };

    } catch (error) {
      logger.error('Error processing email queue:', error);
      return { processed, sent, failed };
    }
  }

  /**
   * Retry failed emails that are ready for retry
   */
  async retryFailedEmails(): Promise<number> {
    try {
      const now = new Date();
      const result = await database.email_queue.updateMany({
        where: {
          status: 'failed',
          next_retry_at: { lte: now },
          retry_count: { lt: 3 }
        },
        data: {
          status: 'pending'
        }
      });

      logger.info(`Reset ${result.count} failed emails for retry`);
      return result.count;
    } catch (error) {
      logger.error('Error retrying failed emails:', error);
      return 0;
    }
  }

  /**
   * Clean up old sent/failed emails (older than 30 days)
   */
  async cleanupOldEmails(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await database.email_queue.deleteMany({
        where: {
          status: { in: ['sent', 'failed'] },
          created_at: { lt: thirtyDaysAgo }
        }
      });

      logger.info(`Cleaned up ${result.count} old emails`);
      return result.count;
    } catch (error) {
      logger.error('Error cleaning up old emails:', error);
      return 0;
    }
  }
}

// Singleton instance
const emailProcessor = new EmailProcessorService();

export default emailProcessor;

// Export for direct imports
export { emailProcessor, EmailProcessorService };
