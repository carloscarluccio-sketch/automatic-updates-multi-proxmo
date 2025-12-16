import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { Parser } from 'json2csv';

const prisma = new PrismaClient();

export const exportActivityLogsCSV = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { start_date, end_date, activity_type, status, entity_type } = req.query;

    const where: any = {};

    if (user.role !== 'super_admin') {
      where.company_id = user.company_id;
    }

    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at.gte = new Date(start_date as string);
      }
      if (end_date) {
        where.created_at.lte = new Date(end_date as string);
      }
    }

    if (activity_type && activity_type !== 'all') {
      where.activity_type = activity_type;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (entity_type && entity_type !== 'all') {
      where.entity_type = entity_type;
    }

    const logs = await prisma.activity_logs.findMany({
      where,
      include: {
        users: {
          select: {
            email: true,
            username: true
          }
        },
        companies: {
          select: {
            name: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 10000
    });

    if (logs.length === 0) {
      res.status(404).json({ success: false, message: 'No activity logs found for export' });
      return;
    }

    const csvData = logs.map(log => ({
      id: log.id,
      timestamp: log.created_at,
      user_email: log.users?.email || 'System',
      user_name: log.users?.username || 'System',
      company: log.companies?.name || 'N/A',
      activity_type: log.activity_type,
      entity_type: log.entity_type,
      entity_id: log.entity_id || 'N/A',
      action: log.action,
      description: log.description,
      status: log.status,
      ip_address: log.ip_address || 'N/A',
      user_agent: log.user_agent || 'N/A'
    }));

    const fields = [
      'id',
      'timestamp',
      'user_email',
      'user_name',
      'company',
      'activity_type',
      'entity_type',
      'entity_id',
      'action',
      'description',
      'status',
      'ip_address',
      'user_agent'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(csvData);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `activity_logs_${timestamp}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

    logger.info(`User ${user.id} exported ${logs.length} activity logs to CSV`);
  } catch (error: any) {
    logger.error('Export activity logs CSV error:', error);
    res.status(500).json({ success: false, message: 'Failed to export activity logs' });
  }
};

export const exportActivityLogsJSON = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { start_date, end_date, activity_type, status, entity_type } = req.query;

    const where: any = {};

    if (user.role !== 'super_admin') {
      where.company_id = user.company_id;
    }

    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at.gte = new Date(start_date as string);
      }
      if (end_date) {
        where.created_at.lte = new Date(end_date as string);
      }
    }

    if (activity_type && activity_type !== 'all') {
      where.activity_type = activity_type;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (entity_type && entity_type !== 'all') {
      where.entity_type = entity_type;
    }

    const logs = await prisma.activity_logs.findMany({
      where,
      include: {
        users: {
          select: {
            id: true,
            email: true,
            username: true
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
      take: 10000
    });

    if (logs.length === 0) {
      res.status(404).json({ success: false, message: 'No activity logs found for export' });
      return;
    }

    const jsonData = {
      export_date: new Date().toISOString(),
      exported_by: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      filters: {
        start_date: start_date || null,
        end_date: end_date || null,
        activity_type: activity_type || 'all',
        status: status || 'all',
        entity_type: entity_type || 'all'
      },
      total_records: logs.length,
      logs: logs.map(log => ({
        id: log.id,
        timestamp: log.created_at,
        user: log.users ? {
          id: log.users.id,
          email: log.users.email,
          username: log.users.username
        } : null,
        company: log.companies ? {
          id: log.companies.id,
          name: log.companies.name
        } : null,
        activity_type: log.activity_type,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        action: log.action,
        description: log.description,
        status: log.status,
        metadata: log.metadata,
        ip_address: log.ip_address,
        user_agent: log.user_agent
      }))
    };

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `activity_logs_${timestamp}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(jsonData);

    logger.info(`User ${user.id} exported ${logs.length} activity logs to JSON`);
  } catch (error: any) {
    logger.error('Export activity logs JSON error:', error);
    res.status(500).json({ success: false, message: 'Failed to export activity logs' });
  }
};

export default {
  exportActivityLogsCSV,
  exportActivityLogsJSON
};
