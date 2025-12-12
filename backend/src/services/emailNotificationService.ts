import nodemailer, { Transporter } from 'nodemailer';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Email Notification Service
 *
 * Handles sending emails via SMTP and manages the notification queue
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

interface QueuedEmail {
  id: number;
  user_id: number;
  notification_type: string;
  recipient_email: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  priority: string | null;
  attempts: number | null;
  max_attempts: number | null;
}

class EmailNotificationService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Initialize nodemailer transporter with SMTP settings from environment
   */
  private initializeTransporter(): void {
    try {
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || smtpUser;

      if (!smtpHost || !smtpUser || !smtpPass) {
        logger.warn('SMTP settings not configured. Email notifications will be disabled.');
        logger.info('Required env variables: SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM (optional)');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
        },
      });

      this.isConfigured = true;
      logger.info(`📧 Email service initialized: ${smtpHost}:${smtpPort} (${smtpFrom})`);
    } catch (error: any) {
      logger.error('Failed to initialize email transporter:', error);
    }
  }

  /**
   * Send an email immediately (bypass queue)
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email service not configured. Email not sent.');
      return false;
    }

    try {
      const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;

      const info = await this.transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'Proxmox Multi-Tenant'}" <${smtpFrom}>`,
        to: options.to,
        subject: options.subject,
        text: options.text || this.htmlToText(options.html),
        html: options.html,
        priority: this.mapPriority(options.priority),
      });

      logger.info(`✅ Email sent to ${options.to}: ${info.messageId}`);
      return true;
    } catch (error: any) {
      logger.error(`❌ Failed to send email to ${options.to}:`, error.message);
      return false;
    }
  }

  /**
   * Queue an email for later sending
   */
  async queueEmail(
    userId: number,
    notificationType: string,
    recipientEmail: string,
    subject: string,
    bodyHtml: string,
    options: {
      bodyText?: string;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      scheduledFor?: Date;
      metadata?: any;
    } = {}
  ): Promise<number> {
    try {
      const queueEntry = await prisma.notification_queue.create({
        data: {
          user_id: userId,
          notification_type: notificationType,
          recipient_email: recipientEmail,
          subject,
          body_html: bodyHtml,
          body_text: options.bodyText || this.htmlToText(bodyHtml),
          priority: options.priority || 'normal',
          status: 'pending',
          scheduled_for: options.scheduledFor || null,
          metadata: options.metadata ? JSON.stringify(options.metadata) : null,
        },
      });

      logger.info(`📬 Email queued [ID: ${queueEntry.id}] for ${recipientEmail}`);
      return queueEntry.id;
    } catch (error: any) {
      logger.error('Failed to queue email:', error);
      throw error;
    }
  }

  /**
   * Process pending emails in the queue
   */
  async processQueue(limit: number = 50): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      logger.debug('Email service not configured. Skipping queue processing.');
      return;
    }

    try {
      // Get pending emails, prioritized by priority and creation time
      const pendingEmails = await prisma.notification_queue.findMany({
        where: {
          status: 'pending',
          attempts: {
            lt: prisma.notification_queue.fields.max_attempts,
          },
          OR: [
            { scheduled_for: null },
            { scheduled_for: { lte: new Date() } },
          ],
        },
        orderBy: [
          { priority: 'desc' },
          { created_at: 'asc' },
        ],
        take: limit,
      });

      if (pendingEmails.length === 0) {
        logger.debug('No pending emails in queue');
        return;
      }

      logger.info(`📧 Processing ${pendingEmails.length} queued emails...`);

      let sentCount = 0;
      let failedCount = 0;

      for (const email of pendingEmails) {
        const success = await this.sendQueuedEmail(email);
        if (success) {
          sentCount++;
        } else {
          failedCount++;
        }
      }

      logger.info(`✅ Queue processing complete: ${sentCount} sent, ${failedCount} failed`);
    } catch (error: any) {
      logger.error('Error processing email queue:', error);
    }
  }

  /**
   * Send a specific queued email
   */
  private async sendQueuedEmail(email: QueuedEmail): Promise<boolean> {
    try {
      const attempts = email.attempts || 0;

      // Update status to 'sending'
      await prisma.notification_queue.update({
        where: { id: email.id },
        data: {
          status: 'sending',
          attempts: attempts + 1,
          last_attempt: new Date(),
        },
      });

      const success = await this.sendEmail({
        to: email.recipient_email,
        subject: email.subject,
        html: email.body_html,
        text: email.body_text || undefined,
        priority: email.priority as any,
      });

      if (success) {
        // Mark as sent
        await prisma.notification_queue.update({
          where: { id: email.id },
          data: {
            status: 'sent',
            sent_at: new Date(),
          },
        });
        return true;
      } else {
        // Check if max attempts reached
        const attempts = email.attempts || 0;
        const maxAttempts = email.max_attempts || 3;

        if (attempts + 1 >= maxAttempts) {
          await prisma.notification_queue.update({
            where: { id: email.id },
            data: {
              status: 'failed',
              error_message: 'Max send attempts reached',
            },
          });
          logger.warn(`❌ Email [ID: ${email.id}] failed after ${maxAttempts} attempts`);
        } else {
          // Reset to pending for retry
          await prisma.notification_queue.update({
            where: { id: email.id },
            data: {
              status: 'pending',
              error_message: 'Send failed, will retry',
            },
          });
        }
        return false;
      }
    } catch (error: any) {
      logger.error(`Error sending queued email [ID: ${email.id}]:`, error);

      // Mark as failed
      await prisma.notification_queue.update({
        where: { id: email.id },
        data: {
          status: 'failed',
          error_message: error.message,
        },
      });

      return false;
    }
  }

  /**
   * Send alert notification email
   */
  async sendAlertNotification(
    userId: number,
    userEmail: string,
    alertData: {
      ruleName: string;
      severity: string;
      targetName: string;
      metricType: string;
      currentValue: number;
      thresholdValue: number;
      message: string;
    }
  ): Promise<void> {
    const html = `
      <h2>🚨 Alert: ${alertData.ruleName}</h2>
      <p><strong>Severity:</strong> ${alertData.severity.toUpperCase()}</p>
      <p><strong>Target:</strong> ${alertData.targetName}</p>
      <p><strong>Metric:</strong> ${alertData.metricType}</p>
      <p><strong>Current Value:</strong> ${alertData.currentValue.toFixed(2)}</p>
      <p><strong>Threshold:</strong> ${alertData.thresholdValue}</p>
      <hr>
      <p>${alertData.message}</p>
      <hr>
      <p style="color: #666; font-size: 12px;">
        This is an automated alert from your Proxmox Multi-Tenant platform.
        <br>You can manage your alert rules and notification settings in the dashboard.
      </p>
    `;

    await this.queueEmail(
      userId,
      'alert_triggered',
      userEmail,
      `[${alertData.severity.toUpperCase()}] Alert: ${alertData.ruleName}`,
      html,
      {
        priority: alertData.severity === 'critical' ? 'critical' : 'high',
        metadata: alertData,
      }
    );
  }

  /**
   * Basic HTML to text conversion
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Map priority to nodemailer priority
   */
  private mapPriority(priority?: string): 'high' | 'normal' | 'low' {
    switch (priority) {
      case 'critical':
      case 'high':
        return 'high';
      case 'low':
        return 'low';
      default:
        return 'normal';
    }
  }

  /**
   * Test SMTP connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured || !this.transporter) {
      return {
        success: false,
        message: 'Email service not configured. Check SMTP environment variables.',
      };
    }

    try {
      await this.transporter.verify();
      return {
        success: true,
        message: 'SMTP connection successful',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `SMTP connection failed: ${error.message}`,
      };
    }
  }
}

// Export singleton instance
export default new EmailNotificationService();
