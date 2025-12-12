import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Get feedback submissions
 */
export const getFeedback = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id, id: userId } = req.user!;
    const { companyId, status, type, priority, limit = 50, offset = 0 } = req.query;

    let where: any = {};

    // Access control
    if (role === 'super_admin') {
      if (companyId) where.company_id = Number(companyId);
    } else if (company_id !== null) {
      where.company_id = company_id;
      // Regular users see only their own feedback
      if (role === 'user') {
        where.user_id = userId;
      }
    } else {
      res.status(400).json({ success: false, message: 'No company associated with user' });
      return;
    }

    // Filters
    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;

    const [feedback, total] = await Promise.all([
      prisma.feedback_submissions.findMany({
        where,
        include: {
          users_feedback_submissions_user_idTousers: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true
            }
          },
          companies: {
            select: {
              id: true,
              name: true
            }
          },
          feedback_replies: {
            select: {
              id: true,
              message: true,
              is_internal: true,
              created_at: true,
              users: {
                select: {
                  id: true,
                  email: true,
                  first_name: true,
              last_name: true
                }
              }
            },
            orderBy: { created_at: 'desc' },
            take: 3
          },
          _count: {
            select: {
              feedback_replies: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: Number(limit),
        skip: Number(offset)
      }),
      prisma.feedback_submissions.count({ where })
    ]);

    res.json({
      success: true,
      data: feedback,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: total > Number(offset) + Number(limit)
      }
    });
  } catch (error) {
    logger.error('Get feedback error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch feedback' });
  }
};

/**
 * Get single feedback submission
 */
export const getFeedbackById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id, id: userId } = req.user!;

    let where: any = { id: Number(id) };

    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
      if (role === 'user') {
        where.user_id = userId;
      }
    }

    const feedback = await prisma.feedback_submissions.findFirst({
      where,
      include: {
        users_feedback_submissions_user_idTousers: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            role: true
          }
        },
        companies: {
          select: {
            id: true,
            name: true
          }
        },
        feedback_replies: {
          include: {
            users: {
              select: {
                id: true,
                email: true,
                first_name: true,
              last_name: true,
                role: true
              }
            }
          },
          orderBy: { created_at: 'asc' }
        }
      }
    });

    if (!feedback) {
      res.status(404).json({ success: false, message: 'Feedback not found' });
      return;
    }

    res.json({ success: true, data: feedback });
  } catch (error) {
    logger.error('Get feedback by ID error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch feedback' });
  }
};

/**
 * Create feedback submission
 */
export const createFeedback = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      type = 'feedback',
      category,
      subject,
      description,
      priority = 'medium',
      attachments,
      metadata
    } = req.body;

    const { id: userId, company_id } = req.user!;

    if (!subject || !description) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: subject, description'
      });
      return;
    }

    if (company_id === null) {
      res.status(400).json({ success: false, message: 'No company associated with user' });
      return;
    }

    const feedback = await prisma.feedback_submissions.create({
      data: {
        company_id,
        user_id: userId!,
        type,
        category,
        subject,
        description,
        priority,
        status: 'new',
        attachments: attachments ? JSON.stringify(attachments) : null,
        metadata: metadata ? JSON.stringify(metadata) : null
      },
      include: {
        users_feedback_submissions_user_idTousers: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        }
      }
    });

    logger.info(`Feedback created: ${feedback.id} by user ${userId}`);
    res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    logger.error('Create feedback error:', error);
    res.status(500).json({ success: false, message: 'Failed to create feedback' });
  }
};

/**
 * Update feedback status
 */
export const updateFeedbackStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, assigned_to, resolution } = req.body;
    const { role, company_id } = req.user!;

    // Only admins can update status
    if (role !== 'super_admin' && role !== 'company_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.feedback_submissions.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Feedback not found' });
      return;
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to ? Number(assigned_to) : null;
    if (resolution) updateData.resolution = resolution;

    if (status === 'resolved' || status === 'closed') {
      updateData.resolved_at = new Date();
    }

    const updated = await prisma.feedback_submissions.update({
      where: { id: Number(id) },
      data: updateData
    });

    logger.info(`Feedback ${id} status updated to ${status}`);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Update feedback status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update feedback status' });
  }
};

/**
 * Add reply to feedback
 */
export const addFeedbackReply = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { message, is_internal = false, attachments } = req.body;
    const { id: userId, role, company_id } = req.user!;

    if (!message) {
      res.status(400).json({ success: false, message: 'Message is required' });
      return;
    }

    // Check access to feedback
    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const feedback = await prisma.feedback_submissions.findFirst({ where });
    if (!feedback) {
      res.status(404).json({ success: false, message: 'Feedback not found' });
      return;
    }

    const reply = await prisma.feedback_replies.create({
      data: {
        feedback_id: Number(id),
        user_id: userId!,
        message,
        is_internal,
        attachments: attachments ? JSON.stringify(attachments) : null
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            role: true
          }
        }
      }
    });

    // Update feedback updated_at
    await prisma.feedback_submissions.update({
      where: { id: Number(id) },
      data: { updated_at: new Date() }
    });

    logger.info(`Reply added to feedback ${id} by user ${userId}`);
    res.status(201).json({ success: true, data: reply });
  } catch (error) {
    logger.error('Add feedback reply error:', error);
    res.status(500).json({ success: false, message: 'Failed to add reply' });
  }
};

/**
 * Delete feedback
 */
export const deleteFeedback = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    // Only admins can delete
    if (role !== 'super_admin' && role !== 'company_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    let where: any = { id: Number(id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const existing = await prisma.feedback_submissions.findFirst({ where });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Feedback not found' });
      return;
    }

    await prisma.feedback_submissions.delete({
      where: { id: Number(id) }
    });

    logger.info(`Feedback deleted: ${id}`);
    res.json({ success: true, message: 'Feedback deleted successfully' });
  } catch (error) {
    logger.error('Delete feedback error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete feedback' });
  }
};

/**
 * Get feedback statistics
 */
export const getFeedbackStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;

    let where: any = {};
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const [total, byStatus, byType, byPriority] = await Promise.all([
      prisma.feedback_submissions.count({ where }),
      prisma.feedback_submissions.groupBy({
        by: ['status'],
        where,
        _count: true
      }),
      prisma.feedback_submissions.groupBy({
        by: ['type'],
        where,
        _count: true
      }),
      prisma.feedback_submissions.groupBy({
        by: ['priority'],
        where,
        _count: true
      })
    ]);

    res.json({
      success: true,
      data: {
        total,
        by_status: byStatus.map(item => ({ status: item.status, count: item._count })),
        by_type: byType.map(item => ({ type: item.type, count: item._count })),
        by_priority: byPriority.map(item => ({ priority: item.priority, count: item._count }))
      }
    });
  } catch (error) {
    logger.error('Get feedback stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch feedback statistics' });
  }
};
