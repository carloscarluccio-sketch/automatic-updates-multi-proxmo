import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Email Notification Service
 * Queues emails for support tickets and other notifications
 */

interface EmailData {
  to: string;
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
  }>;
}

/**
 * Queue an email for sending
 */
export const queueEmail = async (emailData: EmailData): Promise<void> => {
  try {
    await prisma.email_queue.create({
      data: {
        recipient_email: emailData.to,
        subject: emailData.subject,
        body_html: emailData.body,
        body_text: null,
        status: 'pending',
        priority: 5,
        attachments: emailData.attachments ? JSON.stringify(emailData.attachments) : undefined
      }
    });

    logger.info(`Email queued for ${emailData.to}: ${emailData.subject}`);
  } catch (error) {
    logger.error('Failed to queue email:', error);
  }
};

/**
 * Send email notification when a new ticket is created
 */
export const sendTicketCreatedEmail = async (ticketId: number): Promise<void> => {
  try {
    const ticket = await prisma.support_tickets.findUnique({
      where: { id: ticketId },
      include: {
        companies: { select: { name: true } },
        users_support_tickets_created_byTousers: {
          select: { username: true, email: true, first_name: true, last_name: true }
        }
      }
    });

    if (!ticket) {
      logger.error(`Ticket ${ticketId} not found for email notification`);
      return;
    }

    const creator = ticket.users_support_tickets_created_byTousers;
    const creatorName = creator.first_name
      ? `${creator.first_name} ${creator.last_name}`.trim()
      : creator.username;

    // Email to ticket creator (confirmation)
    await queueEmail({
      to: creator.email,
      subject: `Support Ticket Created: ${ticket.ticket_number}`,
      body: `
Hello ${creatorName},

Your support ticket has been created successfully.

Ticket Number: ${ticket.ticket_number}
Subject: ${ticket.subject}
Priority: ${ticket.priority}
Status: ${ticket.status}

Description:
${ticket.description}

You will receive email notifications when there are updates to your ticket.

Thank you,
${ticket.companies.name} Support Team
      `.trim()
    });

    // Email to support team (notification of new ticket)
    const company = await prisma.companies.findUnique({
      where: { id: ticket.company_id },
      select: { support_email: true, name: true }
    });

    if (company && company.support_email) {
      await queueEmail({
        to: company.support_email,
        subject: `[New Ticket] ${ticket.ticket_number} - ${ticket.subject}`,
        body: `
New support ticket created:

Ticket Number: ${ticket.ticket_number}
Company: ${ticket.companies.name}
Created By: ${creatorName} (${creator.email})
Priority: ${ticket.priority}
Status: ${ticket.status}
Subject: ${ticket.subject}

Description:
${ticket.description}

Please respond to this ticket at your earliest convenience.

---
This is an automated notification from the support system.
        `.trim()
      });
      
      logger.info(`Support team notified for ticket ${ticket.ticket_number}`);
    }

    logger.info(`Ticket created email sent for ticket ${ticket.ticket_number}`);
  } catch (error) {
    logger.error(`Failed to send ticket created email for ticket ${ticketId}:`, error);
  }
};

/**
 * Send email notification when a new message is added to a ticket
 */
export const sendTicketMessageEmail = async (messageId: number): Promise<void> => {
  try {
    const message = await prisma.support_ticket_messages.findUnique({
      where: { id: messageId },
      include: {
        support_tickets: {
          include: {
            companies: { select: { name: true } },
            users_support_tickets_created_byTousers: {
              select: { username: true, email: true, first_name: true, last_name: true }
            },
            users_support_tickets_assigned_toTousers: {
              select: { username: true, email: true, first_name: true, last_name: true }
            }
          }
        },
        users: {
          select: { username: true, email: true, first_name: true, last_name: true, role: true }
        }
      }
    });

    if (!message) {
      logger.error(`Message ${messageId} not found for email notification`);
      return;
    }

    const ticket = message.support_tickets;
    const sender = message.users;
    const creator = ticket.users_support_tickets_created_byTousers;
    const assignedTo = ticket.users_support_tickets_assigned_toTousers;

    const senderName = sender.first_name
      ? `${sender.first_name} ${sender.last_name}`.trim()
      : sender.username;

    const senderType = sender.role === 'super_admin' || sender.role === 'company_admin'
      ? 'Support Team'
      : 'Customer';

    // Email to ticket creator (if they didn't send the message)
    if (creator.email !== sender.email) {
      const creatorName = creator.first_name
        ? `${creator.first_name} ${creator.last_name}`.trim()
        : creator.username;

      await queueEmail({
        to: creator.email,
        subject: `New Message on Ticket ${ticket.ticket_number}`,
        body: `
Hello ${creatorName},

A new message has been added to your support ticket.

Ticket Number: ${ticket.ticket_number}
Subject: ${ticket.subject}
From: ${senderName} (${senderType})

Message:
${message.message}

---
Reply to this ticket: ${process.env.FRONTEND_URL || 'https://panel.example.com'}/support-tickets

Thank you,
${ticket.companies.name} Support Team
        `.trim()
      });
    }

    // Email to assigned support staff (if assigned and they didn't send the message)
    if (assignedTo && assignedTo.email !== sender.email) {
      const assignedName = assignedTo.first_name
        ? `${assignedTo.first_name} ${assignedTo.last_name}`.trim()
        : assignedTo.username;

      await queueEmail({
        to: assignedTo.email,
        subject: `New Message on Assigned Ticket ${ticket.ticket_number}`,
        body: `
Hello ${assignedName},

A new message has been added to a ticket assigned to you.

Ticket Number: ${ticket.ticket_number}
Subject: ${ticket.subject}
From: ${senderName} (${senderType})
Priority: ${ticket.priority}

Message:
${message.message}

---
View ticket: ${process.env.FRONTEND_URL || 'https://panel.example.com'}/support-tickets

Thank you,
Support System
        `.trim()
      });
    }

    logger.info(`Ticket message email sent for message ${messageId}`);
  } catch (error) {
    logger.error(`Failed to send ticket message email for message ${messageId}:`, error);
  }
};

/**
 * Send email notification when ticket status changes
 */
export const sendTicketStatusChangeEmail = async (
  ticketId: number,
  oldStatus: string,
  newStatus: string
): Promise<void> => {
  try {
    const ticket = await prisma.support_tickets.findUnique({
      where: { id: ticketId },
      include: {
        companies: { select: { name: true } },
        users_support_tickets_created_byTousers: {
          select: { username: true, email: true, first_name: true, last_name: true }
        }
      }
    });

    if (!ticket) {
      logger.error(`Ticket ${ticketId} not found for status change email`);
      return;
    }

    const creator = ticket.users_support_tickets_created_byTousers;
    const creatorName = creator.first_name
      ? `${creator.first_name} ${creator.last_name}`.trim()
      : creator.username;

    await queueEmail({
      to: creator.email,
      subject: `Ticket Status Updated: ${ticket.ticket_number}`,
      body: `
Hello ${creatorName},

The status of your support ticket has been updated.

Ticket Number: ${ticket.ticket_number}
Subject: ${ticket.subject}

Status Changed: ${oldStatus} → ${newStatus}

${newStatus === 'resolved' ? 'Your issue has been marked as resolved. If you have any further questions, please reply to this ticket.' : ''}
${newStatus === 'closed' ? 'This ticket has been closed. If you need further assistance, please create a new ticket.' : ''}

Thank you,
${ticket.companies.name} Support Team
      `.trim()
    });

    logger.info(`Ticket status change email sent for ticket ${ticket.ticket_number}`);
  } catch (error) {
    logger.error(`Failed to send ticket status change email for ticket ${ticketId}:`, error);
  }
};

/**
 * Send general notification email
 */
export const sendNotificationEmail = async (
  to: string,
  subject: string,
  message: string
): Promise<void> => {
  await queueEmail({
    to,
    subject,
    body: message
  });
};


/**
 * Test SMTP connection
 */
export const testConnection = async (config?: any): Promise<{ success: boolean; message: string }> => {
  const { emailProcessor } = require('./emailProcessorService');
  return await emailProcessor.testSMTPConnection(config);
};

/**
 * Send email directly (queues internally)
 */
export const sendEmail = async (emailData: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  priority?: string;
}): Promise<boolean> => {
  try {
    await queueEmail({
      to: emailData.to,
      subject: emailData.subject,
      body: emailData.html || emailData.text || ''
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Process email queue manually
 */
export const processQueue = async (): Promise<void> => {
  const { emailProcessor } = require('./emailProcessorService');
  const pendingEmails = await prisma.email_queue.findMany({
    where: { status: 'pending' },
    take: 10
  });
  
  for (const email of pendingEmails) {
    await emailProcessor.sendEmail(email as any);
  }
};

/**
 * Send alert notification email
 */
export const sendAlertNotification = async (
  _userId: number,
  email: string,
  alertData: any
): Promise<void> => {
  await queueEmail({
    to: email,
    subject: `Alert: ${alertData.ruleName || 'System Alert'}`,
    body: `Alert triggered for ${alertData.targetName || 'resource'}. Metric: ${alertData.metricType}`
  });
};

/**
 * Send invoice email with PDF attachment
 */
export const sendInvoiceEmail = async (invoiceId: number): Promise<{ success: boolean; message: string }> => {
  try {
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
            primary_email: true
          }
        },
        users: {
          select: {
            email: true,
            first_name: true,
            last_name: true,
            username: true
          }
        }
      }
    });

    if (!invoice) {
      return { success: false, message: 'Invoice not found' };
    }

    // Generate PDF if not already generated
    const path = require('path');
    const fs = require('fs');
    let pdfPath: string | undefined;

    if (invoice.pdf_file_path && invoice.pdf_generated) {
      // PDF already exists, use it
      const invoiceDir = path.join(__dirname, '../../invoices');
      const fileName = invoice.pdf_file_path.split('/').pop();
      pdfPath = path.join(invoiceDir, fileName);
      
      // Check if file exists
      if (!fs.existsSync(pdfPath)) {
        // File missing, regenerate
        const { generateInvoicePDF } = require('./pdfGenerationService');
        const result = await generateInvoicePDF(invoiceId);
        if (result.success) {
          pdfPath = result.filePath;
        }
      }
    } else {
      // Generate PDF
      const { generateInvoicePDF } = require('./pdfGenerationService');
      const result = await generateInvoicePDF(invoiceId);
      if (result.success) {
        pdfPath = result.filePath;
      }
    }

    const recipientEmail = invoice.sent_to_email || invoice.companies.primary_email;
    const recipientName = invoice.users
      ? (invoice.users.first_name ? `${invoice.users.first_name} ${invoice.users.last_name}`.trim() : invoice.users.username)
      : invoice.companies.name;

    const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    const totalAmount = parseFloat(invoice.total_amount.toString()).toFixed(2);

    // Prepare attachments if PDF was generated
    const attachments = pdfPath ? [{
      filename: `${invoice.invoice_number}.pdf`,
      path: pdfPath,
      contentType: 'application/pdf'
    }] : undefined;

    await queueEmail({
      to: recipientEmail,
      subject: `Invoice ${invoice.invoice_number} from ${invoice.companies.name}`,
      body: `
Hello ${recipientName},

Your invoice is now available${pdfPath ? ' and attached to this email' : ''}.

Invoice Number: ${invoice.invoice_number}
Amount Due: $${totalAmount} ${invoice.currency}
Due Date: ${dueDate}

Billing Period: ${new Date(invoice.billing_period_start).toLocaleDateString()} - ${new Date(invoice.billing_period_end).toLocaleDateString()}

${invoice.notes ? `
Notes:
${invoice.notes}
` : ''}

You can also view and download your invoice from the billing section of your account dashboard.

${invoice.status === 'paid' ? 'This invoice has been paid. Thank you for your payment!' : ''}
${invoice.due_date && new Date(invoice.due_date) < new Date() ? 'NOTICE: This invoice is overdue. Please submit payment as soon as possible to avoid service interruption.' : ''}

Thank you for your business!

${invoice.companies.name}
      `.trim(),
      attachments
    });

    logger.info(`Invoice email queued for invoice ${invoice.invoice_number} to ${recipientEmail}${pdfPath ? ' with PDF attachment' : ''}`);

    return { success: true, message: `Invoice email sent to ${recipientEmail}` };
  } catch (error: any) {
    logger.error(`Failed to send invoice email for invoice ${invoiceId}:`, error);
    return { success: false, message: error.message || 'Failed to send invoice email' };
  }
};

/**
 * Send budget threshold alert email
 */
export const sendBudgetThresholdAlert = async (
  companyId: number,
  currentSpend: number,
  threshold: number,
  thresholdPercent: number
): Promise<void> => {
  try {
    const company = await prisma.companies.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        primary_email: true
      }
    });

    if (!company) {
      logger.error(`Company ${companyId} not found for budget alert`);
      return;
    }

    // Get company admins
    const companyAdmins = await prisma.users.findMany({
      where: {
        company_id: companyId,
        role: 'company_admin',
        status: 'active'
      },
      select: {
        email: true,
        first_name: true,
        last_name: true,
        username: true
      }
    });

    const recipients = companyAdmins.length > 0
      ? companyAdmins.map(admin => admin.email)
      : [company.primary_email];

    const alertLevel = thresholdPercent >= 100 ? 'CRITICAL' :
                       thresholdPercent >= 90 ? 'WARNING' :
                       'NOTICE';

    const currentSpendFormatted = currentSpend.toFixed(2);
    const thresholdFormatted = threshold.toFixed(2);

    for (const recipientEmail of recipients) {
      await queueEmail({
        to: recipientEmail,
        subject: `[${alertLevel}] Budget Threshold Alert - ${company.name}`,
        body: `
${alertLevel}: Budget Threshold Alert

Company: ${company.name}

Your current spending has reached ${thresholdPercent.toFixed(0)}% of your budget threshold.

Current Spend: $${currentSpendFormatted}
Budget Threshold: $${thresholdFormatted}
Percentage Used: ${thresholdPercent.toFixed(1)}%

${thresholdPercent >= 100 ? 'You have exceeded your budget threshold! Please review your resource usage and consider upgrading your plan or adding funds.' : ''}
${thresholdPercent >= 90 && thresholdPercent < 100 ? 'You are approaching your budget limit. Please monitor your usage closely to avoid service interruption.' : ''}
${thresholdPercent < 90 ? 'This is a courtesy notification to keep you informed of your current spending.' : ''}

To view detailed usage and billing information, please log in to your account dashboard.

---
This is an automated alert from the billing system.
        `.trim()
      });
    }

    logger.info(`Budget threshold alert sent for company ${company.name} (${thresholdPercent.toFixed(0)}% of threshold)`);
  } catch (error) {
    logger.error(`Failed to send budget threshold alert for company ${companyId}:`, error);
  }
};

/**
 * Send overdue invoice reminder
 */
export const sendOverdueInvoiceReminder = async (invoiceId: number, daysOverdue: number): Promise<void> => {
  try {
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
      include: {
        companies: {
          select: {
            name: true,
            primary_email: true
          }
        }
      }
    });

    if (!invoice) {
      logger.error(`Invoice ${invoiceId} not found for overdue reminder`);
      return;
    }

    const totalAmount = parseFloat(invoice.total_amount.toString()).toFixed(2);
    const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

    await queueEmail({
      to: invoice.sent_to_email || invoice.companies.primary_email,
      subject: `OVERDUE: Invoice ${invoice.invoice_number} - ${daysOverdue} Days Past Due`,
      body: `
PAYMENT OVERDUE NOTICE

Invoice Number: ${invoice.invoice_number}
Amount Due: $${totalAmount} ${invoice.currency}
Original Due Date: ${dueDate}
Days Overdue: ${daysOverdue}

This invoice is now ${daysOverdue} days past due. Please submit payment immediately to avoid service interruption.

${daysOverdue >= 30 ? 'WARNING: Accounts over 30 days past due may be subject to suspension.' : ''}
${daysOverdue >= 60 ? 'URGENT: This account is at risk of suspension. Please contact billing immediately.' : ''}

If payment has already been sent, please disregard this notice and contact us to confirm receipt.

To pay online, log in to your account dashboard and view this invoice in the billing section.

Thank you,
${invoice.companies.name} Billing Department
      `.trim()
    });

    logger.info(`Overdue reminder sent for invoice ${invoice.invoice_number} (${daysOverdue} days overdue)`);
  } catch (error) {
    logger.error(`Failed to send overdue invoice reminder for invoice ${invoiceId}:`, error);
  }
};

export default {
  queueEmail,
  sendTicketCreatedEmail,
  sendTicketMessageEmail,
  sendTicketStatusChangeEmail,
  sendNotificationEmail,
  testConnection,
  sendEmail,
  processQueue,
  sendAlertNotification,
  sendInvoiceEmail,
  sendBudgetThresholdAlert,
  sendOverdueInvoiceReminder
};
