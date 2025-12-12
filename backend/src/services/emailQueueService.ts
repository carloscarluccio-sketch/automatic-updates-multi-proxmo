/**
 * Email Queue Service
 * Handles email queueing, processing, and delivery
 * Author: Claude (Autonomous Implementation)
 * Date: December 11, 2025
 */

import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

interface EmailOptions {
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  cc?: string;
  bcc?: string;
  priority?: number;
  scheduledAt?: Date;
  contextType?: string;
  contextId?: number;
  companyId?: number;
  userId?: number;
  attachments?: any[];
}

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  fromName: string;
}

/**
 * Get SMTP configuration from environment variables
 */
function getSMTPConfig(): SMTPConfig {
  return {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    from: process.env.SMTP_FROM_EMAIL || 'noreply@proxmox-multi-tenant.local',
    fromName: process.env.SMTP_FROM_NAME || 'Proxmox Multi-Tenant',
  };
}

/**
 * Add email to queue
 */
export async function addEmailToQueue(options: EmailOptions) {
  try {
    const email = await prisma.email_queue.create({
      data: {
        recipient_email: options.recipientEmail,
        recipient_name: options.recipientName || null,
        subject: options.subject,
        body_html: options.bodyHtml,
        body_text: options.bodyText || null,
        from_email: options.fromEmail || getSMTPConfig().from,
        from_name: options.fromName || getSMTPConfig().fromName,
        reply_to: options.replyTo || null,
        cc: options.cc || null,
        bcc: options.bcc || null,
        status: 'pending',
        priority: options.priority || 5,
        scheduled_at: options.scheduledAt || null,
        context_type: options.contextType || null,
        context_id: options.contextId || null,
        company_id: options.companyId || null,
        user_id: options.userId || null,
        attachments: options.attachments ? JSON.stringify(options.attachments) : undefined,
      },
    });

    console.log(`[EmailQueue] Email added to queue: ID ${email.id}, Recipient: ${email.recipient_email}`);
    return { success: true, emailId: email.id };
  } catch (error: any) {
    console.error('[EmailQueue] Error adding email to queue:', error.message);
    throw error;
  }
}

/**
 * Process email queue
 * Sends pending emails that are scheduled or immediate
 */
export async function processEmailQueue(limit: number = 10) {
  try {
    const now = new Date();

    // Get pending emails that are ready to send
    const emails = await prisma.email_queue.findMany({
      where: {
        status: 'pending',
        OR: [
          { scheduled_at: null }, // Immediate emails
          { scheduled_at: { lte: now } }, // Scheduled emails ready to send
        ],
      },
      orderBy: [
        { priority: 'asc' }, // Lower number = higher priority
        { created_at: 'asc' },
      ],
      take: limit,
    });

    if (emails.length === 0) {
      console.log('[EmailQueue] No pending emails to process');
      return { success: true, processed: 0, sent: 0, failed: 0 };
    }

    console.log(`[EmailQueue] Processing ${emails.length} emails from queue`);

    let sent = 0;
    let failed = 0;

    for (const email of emails) {
      const result = await sendEmail(email.id);
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    console.log(`[EmailQueue] Processing complete: ${sent} sent, ${failed} failed`);

    return { success: true, processed: emails.length, sent, failed };
  } catch (error: any) {
    console.error('[EmailQueue] Error processing queue:', error.message);
    throw error;
  }
}

/**
 * Send a specific email from the queue
 */
export async function sendEmail(emailId: number) {
  try {
    const email = await prisma.email_queue.findUnique({
      where: { id: emailId },
    });

    if (!email) {
      throw new Error(`Email ID ${emailId} not found in queue`);
    }

    if (email.status !== 'pending') {
      console.log(`[EmailQueue] Email ID ${emailId} status is ${email.status}, skipping`);
      return { success: false, message: 'Email not in pending status' };
    }

    // Update status to sending
    await prisma.email_queue.update({
      where: { id: emailId },
      data: { status: 'sending' },
    });

    const config = getSMTPConfig();

    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });

    // Prepare email message
    const mailOptions: any = {
      from: email.from_name
        ? `"${email.from_name}" <${email.from_email}>`
        : email.from_email,
      to: email.recipient_name
        ? `"${email.recipient_name}" <${email.recipient_email}>`
        : email.recipient_email,
      subject: email.subject,
      html: email.body_html,
      text: email.body_text || undefined,
    };

    if (email.reply_to) {
      mailOptions.replyTo = email.reply_to;
    }

    if (email.cc) {
      mailOptions.cc = email.cc;
    }

    if (email.bcc) {
      mailOptions.bcc = email.bcc;
    }

    // Send email
    const info = await transporter.sendMail(mailOptions);

    // Update status to sent
    await prisma.email_queue.update({
      where: { id: emailId },
      data: {
        status: 'sent',
        sent_at: new Date(),
        error_message: null,
      },
    });

    console.log(`[EmailQueue] Email ID ${emailId} sent successfully to ${email.recipient_email}`);
    console.log(`[EmailQueue] Message ID: ${info.messageId}`);

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[EmailQueue] Error sending email ID ${emailId}:`, error.message);

    // Update email with error and retry logic
    const email = await prisma.email_queue.findUnique({
      where: { id: emailId },
    });

    if (email) {
      const retryCount = (email.retry_count || 0) + 1;
      const maxRetries = email.max_retries || 3;

      if (retryCount < maxRetries) {
        // Calculate exponential backoff: 5min, 15min, 45min
        const backoffMinutes = Math.pow(3, retryCount) * 5;
        const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

        await prisma.email_queue.update({
          where: { id: emailId },
          data: {
            status: 'pending',
            error_message: error.message,
            retry_count: retryCount,
            last_retry_at: new Date(),
            next_retry_at: nextRetryAt,
          },
        });

        console.log(
          `[EmailQueue] Email ID ${emailId} will retry in ${backoffMinutes} minutes (attempt ${retryCount}/${maxRetries})`
        );
      } else {
        // Max retries reached, mark as failed
        await prisma.email_queue.update({
          where: { id: emailId },
          data: {
            status: 'failed',
            error_message: error.message,
            retry_count: retryCount,
            last_retry_at: new Date(),
          },
        });

        console.log(`[EmailQueue] Email ID ${emailId} failed after ${maxRetries} attempts`);
      }
    }

    return { success: false, error: error.message };
  }
}

/**
 * Retry failed emails
 */
export async function retryFailedEmails(limit: number = 5) {
  try {
    const now = new Date();

    // Get emails ready for retry
    const emails = await prisma.email_queue.findMany({
      where: {
        status: 'pending',
        next_retry_at: { lte: now },
        retry_count: { lt: prisma.email_queue.fields.max_retries },
      },
      orderBy: { next_retry_at: 'asc' },
      take: limit,
    });

    console.log(`[EmailQueue] Retrying ${emails.length} failed emails`);

    let retried = 0;
    let failed = 0;

    for (const email of emails) {
      const result = await sendEmail(email.id);
      if (result.success) {
        retried++;
      } else {
        failed++;
      }
    }

    return { success: true, retried, failed };
  } catch (error: any) {
    console.error('[EmailQueue] Error retrying failed emails:', error.message);
    throw error;
  }
}

/**
 * Cancel an email in the queue
 */
export async function cancelEmail(emailId: number) {
  try {
    const email = await prisma.email_queue.findUnique({
      where: { id: emailId },
    });

    if (!email) {
      throw new Error(`Email ID ${emailId} not found`);
    }

    if (email.status === 'sent') {
      throw new Error('Cannot cancel an email that has already been sent');
    }

    await prisma.email_queue.update({
      where: { id: emailId },
      data: { status: 'cancelled' },
    });

    console.log(`[EmailQueue] Email ID ${emailId} cancelled`);
    return { success: true };
  } catch (error: any) {
    console.error(`[EmailQueue] Error cancelling email ID ${emailId}:`, error.message);
    throw error;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  try {
    const stats = await prisma.email_queue.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const statsObj: any = {
      pending: 0,
      sending: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
      total: 0,
    };

    stats.forEach((stat) => {
      statsObj[stat.status] = stat._count.id;
      statsObj.total += stat._count.id;
    });

    // Get recent emails
    const recentEmails = await prisma.email_queue.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        id: true,
        recipient_email: true,
        subject: true,
        status: true,
        created_at: true,
        sent_at: true,
        error_message: true,
      },
    });

    return { success: true, stats: statsObj, recentEmails };
  } catch (error: any) {
    console.error('[EmailQueue] Error getting queue stats:', error.message);
    throw error;
  }
}

/**
 * Test SMTP connection
 */
export async function testSMTPConnection() {
  try {
    const config = getSMTPConfig();

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });

    await transporter.verify();

    console.log('[EmailQueue] SMTP connection successful');
    return { success: true, message: 'SMTP connection successful' };
  } catch (error: any) {
    console.error('[EmailQueue] SMTP connection failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Render email template with variables
 */
export async function renderTemplate(templateName: string, variables: Record<string, any>) {
  try {
    const template = await prisma.email_templates.findUnique({
      where: { name: templateName },
    });

    if (!template) {
      throw new Error(`Email template "${templateName}" not found`);
    }

    let subject = template.subject;
    let bodyHtml = template.body_html;
    let bodyText = template.body_text || '';

    // Replace variables in template
    Object.keys(variables).forEach((key) => {
      const value = variables[key];
      const regex = new RegExp(`{{${key}}}`, 'g');

      subject = subject.replace(regex, value);
      bodyHtml = bodyHtml.replace(regex, value);
      bodyText = bodyText.replace(regex, value);
    });

    return {
      success: true,
      subject,
      bodyHtml,
      bodyText,
    };
  } catch (error: any) {
    console.error('[EmailQueue] Error rendering template:', error.message);
    throw error;
  }
}

export default {
  addEmailToQueue,
  processEmailQueue,
  sendEmail,
  retryFailedEmails,
  cancelEmail,
  getQueueStats,
  testSMTPConnection,
  renderTemplate,
};
