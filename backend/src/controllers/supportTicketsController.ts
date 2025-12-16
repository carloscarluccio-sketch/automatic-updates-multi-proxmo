import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * List support tickets
 * GET /api/support-tickets
 * Super admin sees all, company users see only their company's tickets
 */
export const listTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { status, priority, company_id } = req.query;

    const where: any = {};

    // Role-based filtering
    if (user.role === 'super_admin') {
      // Super admin can filter by company_id or see all
      if (company_id) {
        where.company_id = parseInt(company_id as string);
      }
    } else {
      // Company users only see their company's tickets
      where.company_id = user.company_id;
    }

    // Additional filters
    if (status) {
      where.status = status;
    }
    if (priority) {
      where.priority = priority;
    }

    const tickets = await prisma.support_tickets.findMany({
      where,
      include: {
        companies: {
          select: { id: true, name: true }
        },
        users_support_tickets_created_byTousers: {
          select: { id: true, username: true, email: true }
        },
        users_support_tickets_assigned_toTousers: {
          select: { id: true, username: true, email: true }
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
        companies: {
          select: { id: true, name: true }
        },
        users_support_tickets_created_byTousers: {
          select: { id: true, username: true, email: true }
        },
        users_support_tickets_assigned_toTousers: {
          select: { id: true, username: true, email: true }
        },
        support_ticket_messages: {
          include: {
            users: {
              select: { id: true, username: true, email: true, role: true }
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

    // Permission check
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
 * Super admin can specify company_id, company users use their own company
 */
export const createTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { company_id, subject, description, priority, category, vm_id } = req.body;

    // Validation
    if (!subject || !description) {
      res.status(400).json({ success: false, message: 'Subject and description are required' });
      return;
    }

    // Determine company_id
    let targetCompanyId: number;
    if (user.role === 'super_admin') {
      // Super admin must specify company_id
      if (!company_id) {
        res.status(400).json({ success: false, message: 'company_id is required for super_admin' });
        return;
      }
      targetCompanyId = parseInt(company_id);
    } else {
      // Company users use their own company
      targetCompanyId = user.company_id;
    }

    // Generate unique ticket number
    const ticketCount = await prisma.support_tickets.count();
    const ticketNumber = `TKT-${String(ticketCount + 1).padStart(6, '0')}`;

    const ticket = await prisma.support_tickets.create({
      data: {
        ticket_number: ticketNumber,
        company_id: targetCompanyId,
        created_by: user.id,
        subject,
        description,
        priority: priority || 'medium',
        category: category || null,
        vm_id: vm_id ? parseInt(vm_id) : null,
        status: 'open'
      },
      include: {
        companies: {
          select: { id: true, name: true }
        },
        users_support_tickets_created_byTousers: {
          select: { id: true, username: true, email: true }
        }
      }
    });

    logger.info(`Ticket created: ${ticketNumber} by user ${user.id} for company ${targetCompanyId}`);
    res.status(201).json({ success: true, data: ticket, message: 'Ticket created successfully' });
  } catch (error: any) {
    logger.error('Create ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to create ticket' });
  }
};

/**
 * Update ticket (status, priority, assigned_to, etc.)
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

    // Permission check
    if (user.role !== 'super_admin' && ticket.company_id !== user.company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to ? parseInt(assigned_to) : null;
    if (resolution !== undefined) updateData.resolution = resolution;

    // Set closed_at if status is closed
    if (status === 'closed' || status === 'resolved') {
      updateData.closed_at = new Date();
    }

    const updatedTicket = await prisma.support_tickets.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        companies: {
          select: { id: true, name: true }
        },
        users_support_tickets_assigned_toTousers: {
          select: { id: true, username: true, email: true }
        }
      }
    });

    logger.info(`Ticket ${ticket.ticket_number} updated by user ${user.id}`);
    res.json({ success: true, data: updatedTicket, message: 'Ticket updated successfully' });
  } catch (error: any) {
    logger.error('Update ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to update ticket' });
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

    const ticket = await prisma.support_tickets.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    // Permission check
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
          select: { id: true, username: true, email: true, role: true }
        }
      }
    });

    // Update ticket status if needed
    if (ticket.status === 'waiting_customer' && user.role !== 'super_admin') {
      await prisma.support_tickets.update({
        where: { id: ticketId },
        data: { status: 'waiting_support' }
      });
    } else if (ticket.status === 'waiting_support' && user.role === 'super_admin') {
      await prisma.support_tickets.update({
        where: { id: ticketId },
        data: { status: 'in_progress' }
      });
    }

    logger.info(`Message added to ticket ${ticket.ticket_number} by user ${user.id}`);
    res.status(201).json({ success: true, data: ticketMessage, message: 'Message added successfully' });
  } catch (error: any) {
    logger.error('Add message error:', error);
    res.status(500).json({ success: false, message: 'Failed to add message' });
  }
};

/**
 * Get ticket statistics
 * GET /api/support-tickets/stats
 */
export const getTicketStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    const where: any = user.role === 'super_admin' ? {} : { company_id: user.company_id };

    const [total, open, inProgress, resolved, closed] = await Promise.all([
      prisma.support_tickets.count({ where }),
      prisma.support_tickets.count({ where: { ...where, status: 'open' } }),
      prisma.support_tickets.count({ where: { ...where, status: 'in_progress' } }),
      prisma.support_tickets.count({ where: { ...where, status: 'resolved' } }),
      prisma.support_tickets.count({ where: { ...where, status: 'closed' } })
    ]);

    const stats = {
      total,
      open,
      in_progress: inProgress,
      resolved,
      closed,
      active: open + inProgress
    };

    res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Get ticket stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
};
