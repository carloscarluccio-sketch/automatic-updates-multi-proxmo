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
        priority: 5
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

    // TODO: Email to support team (notification of new ticket)
    // This would require a support_email setting in company or global config

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

export default {
  queueEmail,
  sendTicketCreatedEmail,
  sendTicketMessageEmail,
  sendTicketStatusChangeEmail,
  sendNotificationEmail
};
