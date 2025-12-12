import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Get activity logs with filtering
 */
export const getActivityLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const {
      companyId,
      userId,
      activityType,
      entityType,
      status,
      limit = 100,
      offset = 0
    } = req.query;

    let where: any = {};

    // Access control
    if (role === 'super_admin') {
      if (companyId) where.company_id = Number(companyId);
      if (userId) where.user_id = Number(userId);
    } else if (company_id !== null) {
      where.company_id = company_id;
      if (userId) where.user_id = Number(userId);
    } else {
      res.status(400).json({ success: false, message: 'No company associated with user' });
      return;
    }

    // Additional filters
    if (activityType) where.activity_type = activityType;
    if (entityType) where.entity_type = entityType;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.activity_logs.findMany({
        where,
        include: {
          users: {
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
          }
        },
        orderBy: { created_at: 'desc' },
        take: Number(limit),
        skip: Number(offset)
      }),
      prisma.activity_logs.count({ where })
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: total > Number(offset) + Number(limit)
      }
    });
  } catch (error) {
    logger.error('Get activity logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch activity logs' });
  }
};

/**
 * Get activity log statistics
 */
export const getActivityStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { timeRange = '24h' } = req.query;

    let where: any = {};

    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    // Time range filter
    const now = new Date();
    let startTime: Date;

    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    where.created_at = {
      gte: startTime
    };

    // Get statistics
    const [total, byType, byStatus, recentFailures] = await Promise.all([
      prisma.activity_logs.count({ where }),
      prisma.activity_logs.groupBy({
        by: ['activity_type'],
        where,
        _count: true,
        orderBy: { _count: { activity_type: 'desc' } },
        take: 10
      }),
      prisma.activity_logs.groupBy({
        by: ['status'],
        where,
        _count: true
      }),
      prisma.activity_logs.findMany({
        where: { ...where, status: 'failed' },
        include: {
          users: {
            select: { id: true, email: true }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 10
      })
    ]);

    res.json({
      success: true,
      data: {
        total,
        by_type: byType.map(item => ({
          type: item.activity_type,
          count: item._count
        })),
        by_status: byStatus.map(item => ({
          status: item.status,
          count: item._count
        })),
        recent_failures: recentFailures
      }
    });
  } catch (error) {
    logger.error('Get activity stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch activity statistics' });
  }
};

/**
 * Get audit logs (more detailed security/compliance logs)
 */
export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const {
      companyId,
      userId,
      action,
      resourceType,
      limit = 100,
      offset = 0
    } = req.query;

    let where: any = {};

    // Access control
    if (role === 'super_admin') {
      if (companyId) where.company_id = Number(companyId);
      if (userId) where.user_id = Number(userId);
    } else if (company_id !== null) {
      where.company_id = company_id;
      if (userId) where.user_id = Number(userId);
    } else {
      res.status(400).json({ success: false, message: 'No company associated with user' });
      return;
    }

    // Additional filters
    if (action) where.action = action;
    if (resourceType) where.resource_type = resourceType;

    const [logs, total] = await Promise.all([
      prisma.audit_logs.findMany({
        where,
        include: {
          users: {
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
          }
        },
        orderBy: { created_at: 'desc' },
        take: Number(limit),
        skip: Number(offset)
      }),
      prisma.audit_logs.count({ where })
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: total > Number(offset) + Number(limit)
      }
    });
  } catch (error) {
    logger.error('Get audit logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
};

/**
 * Create activity log entry (for manual logging)
 */
export const createActivityLog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      activity_type,
      entity_type,
      entity_id,
      action,
      description,
      status = 'success',
      metadata
    } = req.body;

    const { id: userId, company_id } = req.user!;

    if (!activity_type || !entity_type || !action || !description) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: activity_type, entity_type, action, description'
      });
      return;
    }

    const log = await prisma.activity_logs.create({
      data: {
        user_id: userId,
        company_id: company_id || undefined,
        activity_type,
        entity_type,
        entity_id: entity_id ? Number(entity_id) : null,
        action,
        description,
        status,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ip_address: req.ip,
        user_agent: req.get('User-Agent') || null
      }
    });

    logger.info(`Activity log created: ${log.id}`);
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    logger.error('Create activity log error:', error);
    res.status(500).json({ success: false, message: 'Failed to create activity log' });
  }
};
