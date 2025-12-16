import { Request, Response } from 'express';
import { sendTicketCreatedEmail, sendTicketMessageEmail, sendTicketStatusChangeEmail } from '../services/emailNotificationService';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Generate unique ticket number
 */
function generateTicketNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TKT-${timestamp}-${random}`;
}

/**
 * List support tickets
 * GET /api/support-tickets
 */
export const listTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { status, priority, category } = req.query;

    const where: any = {};

    // Filter by company for non-super_admin users
    if (user.role !== 'super_admin') {
      where.company_id = user.company_id;
    }

    // Apply filters
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;

    const tickets = await prisma.support_tickets.findMany({
      where,
      include: {
        companies: { select: { name: true } },
        users_support_tickets_created_byTousers: {
          select: { id: true, username: true, email: true, first_name: true, last_name: true }
        },
        users_support_tickets_assigned_toTousers: {
          select: { id: true, username: true, email: true, first_name: true, last_name: true }
        },
        virtual_machines: {
          select: { id: true, name: true, vmid: true }
        },
        _count: {
          select: { support_ticket_messages: true }
        }
      },
      orderBy: { opened_at: 'desc' }
    });

    res.json({ success: true, data: tickets });
  } catch (error: any) {
    logger.error('List tickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
  }
};

/**
 * Get single ticket with messages
 * GET /api/support-tickets/:id
 */
export const getTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const ticketId = parseInt(req.params.id);

    const ticket = await prisma.support_tickets.findUnique({
      where: { id: ticketId },
      include: {
        companies: { select: { name: true } },
        users_support_tickets_created_byTousers: {
          select: { id: true, username: true, email: true, first_name: true, last_name: true }
        },
        users_support_tickets_assigned_toTousers: {
          select: { id: true, username: true, email: true, first_name: true, last_name: true }
        },
        virtual_machines: {
          select: { id: true, name: true, vmid: true }
        },
        support_ticket_messages: {
          include: {
            users: {
              select: { id: true, username: true, email: true, first_name: true, last_name: true, role: true }
            }
          },
          orderBy: { created_at: 'asc' }
        }
      }
    });

    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    // Check permissions
    if (user.role !== 'super_admin' && ticket.company_id !== user.company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    res.json({ success: true, data: ticket });
  } catch (error: any) {
    logger.error('Get ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ticket' });
  }
};

/**
 * Create new support ticket
 * POST /api/support-tickets
 */
export const createTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { subject, description, priority, category, vm_id } = req.body;

    if (!subject || !description) {
      res.status(400).json({ success: false, message: 'Subject and description are required' });
      return;
    }

    const ticketNumber = generateTicketNumber();

    const ticket = await prisma.support_tickets.create({
      data: {
        ticket_number: ticketNumber,
        company_id: user.company_id,
        created_by: user.id,
        subject,
        description,
        priority: priority || 'medium',
        category: category || null,
        vm_id: vm_id || null,
        status: 'open'
      },
      include: {
        companies: { select: { name: true } },
        users_support_tickets_created_byTousers: {
          select: { id: true, username: true, email: true, first_name: true, last_name: true }
        }
      }
    });

    // Log activity
    await prisma.activity_logs.create({
      data: {
        user_id: user.id,
        company_id: user.company_id,
        activity_type: 'support',
        entity_type: 'support_ticket',
        entity_id: ticket.id,
        action: 'ticket_created',
        description: `Support ticket created: ${ticketNumber} - ${subject}`,
        status: 'success',
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null
      }
    });

    logger.info(`Support ticket created: ${ticketNumber} by user ${user.id}`);
    // Send email notification (async, non-blocking)
    sendTicketCreatedEmail(ticket.id).catch((err: any) => logger.error("Failed to send ticket email:", err));

    res.json({ success: true, data: ticket });
  } catch (error: any) {
    logger.error('Create ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to create ticket' });
  }
};

/**
 * Add message to ticket
 * POST /api/support-tickets/:id/messages
 */
export const addMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const ticketId = parseInt(req.params.id);
    const { message, is_internal } = req.body;

    if (!message) {
      res.status(400).json({ success: false, message: 'Message is required' });
      return;
    }

    // Check ticket exists and user has access
    const ticket = await prisma.support_tickets.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    if (user.role !== 'super_admin' && ticket.company_id !== user.company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const ticketMessage = await prisma.support_ticket_messages.create({
      data: {
        ticket_id: ticketId,
        user_id: user.id,
        message,
        is_internal: is_internal || false
      },
      include: {
        users: {
          select: { id: true, username: true, email: true, first_name: true, last_name: true, role: true }
        }
      }
    });

    // Update ticket status if it was waiting for customer
    if (ticket.status === 'waiting_customer' && ticket.created_by === user.id) {
      await prisma.support_tickets.update({
        where: { id: ticketId },
        data: { status: 'in_progress' }
      });
    }

    // Log activity
    await prisma.activity_logs.create({
      data: {
        user_id: user.id,
        company_id: ticket.company_id,
        activity_type: 'support',
        entity_type: 'support_ticket',
        entity_id: ticketId,
        action: 'message_added',
        description: `Message added to ticket ${ticket.ticket_number}`,
        status: 'success'
      }
    });

    // Send email notification for new message (async, non-blocking)
    sendTicketMessageEmail(ticketMessage.id).catch((err: any) => logger.error("Failed to send message email:", err));

    res.json({ success: true, data: ticketMessage });
  } catch (error: any) {
    logger.error('Add message error:', error);
    res.status(500).json({ success: false, message: 'Failed to add message' });
  }
};

/**
 * Update ticket status/assignment
 * PATCH /api/support-tickets/:id
 */
export const updateTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const ticketId = parseInt(req.params.id);
    const { status, priority, assigned_to, resolution } = req.body;

    const ticket = await prisma.support_tickets.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    // Check permissions
    if (user.role !== 'super_admin' && ticket.company_id !== user.company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
    if (resolution) updateData.resolution = resolution;

    // Set closed_at if status is closed or resolved
    if (status === 'closed' || status === 'resolved') {
      updateData.closed_at = new Date();
    }

    const updatedTicket = await prisma.support_tickets.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        companies: { select: { name: true } },
        users_support_tickets_created_byTousers: {
          select: { id: true, username: true, email: true }
        },
        users_support_tickets_assigned_toTousers: {
          select: { id: true, username: true, email: true }
        }
      }
    });

    // Log activity
    await prisma.activity_logs.create({
      data: {
        user_id: user.id,
        company_id: ticket.company_id,
        activity_type: 'support',
        entity_type: 'support_ticket',
        entity_id: ticketId,
        action: 'ticket_updated',
        description: `Ticket ${ticket.ticket_number} updated`,
        status: 'success',
        metadata: JSON.stringify({ updates: updateData })
      }
    });

    // Send email if status changed
    if (status && status !== ticket.status) {
      sendTicketStatusChangeEmail(ticketId, ticket.status || "unknown", status).catch((err: any) => logger.error("Failed to send status change email:", err));
    }

    res.json({ success: true, data: updatedTicket });
  } catch (error: any) {
    logger.error('Update ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to update ticket' });
  }
};

/**
 * Get ticket statistics
 * GET /api/support-tickets/stats
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    const where: any = {};
    if (user.role !== 'super_admin') {
      where.company_id = user.company_id;
    }

    const [total, open, inProgress, resolved, closed] = await Promise.all([
      prisma.support_tickets.count({ where }),
      prisma.support_tickets.count({ where: { ...where, status: 'open' } }),
      prisma.support_tickets.count({ where: { ...where, status: 'in_progress' } }),
      prisma.support_tickets.count({ where: { ...where, status: 'resolved' } }),
      prisma.support_tickets.count({ where: { ...where, status: 'closed' } })
    ]);

    const stats = {
      total,
      by_status: {
        open,
        in_progress: inProgress,
        resolved,
        closed,
        active: open + inProgress
      }
    };

    res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Get stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
};
