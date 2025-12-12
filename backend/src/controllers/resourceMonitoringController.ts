import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';
import { monitorResourceAlerts, autoResolveAlerts } from '../services/resourceMonitoringService';

/**
 * Resource Monitoring Controller
 *
 * Provides API endpoints to manually trigger monitoring and view monitoring status
 * The actual monitoring should run via cron job
 */

/**
 * Manually trigger resource monitoring cycle
 * POST /api/monitoring/trigger
 * Only super_admin can manually trigger monitoring
 */
export const triggerMonitoring = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.user!;

    if (role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Only super administrators can manually trigger monitoring',
      });
      return;
    }

    logger.info(`Manual monitoring cycle triggered by user ${req.user!.id}`);

    // Run monitoring in background (don't block response)
    monitorResourceAlerts()
      .then(() => autoResolveAlerts())
      .catch((error) => logger.error('Background monitoring error:', error));

    res.json({
      success: true,
      message: 'Resource monitoring cycle started',
      note: 'Monitoring is running in the background. Check alert history for results.',
    });
  } catch (error: any) {
    logger.error('Trigger monitoring error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger monitoring',
      error: error.message,
    });
  }
};

/**
 * Get monitoring statistics
 * GET /api/monitoring/stats
 */
export const getMonitoringStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;

    // Build where clause based on permissions
    let alertWhere: any = {};
    let ruleWhere: any = {};

    if (role !== 'super_admin' && company_id !== null) {
      alertWhere.company_id = company_id;
      ruleWhere.company_id = company_id;
    }

    // Get alert statistics
    const [
      totalRules,
      enabledRules,
      triggeredAlerts24h,
      activeAlerts,
      resolvedAlerts24h,
    ] = await Promise.all([
      prisma.alert_rules.count({ where: ruleWhere }),
      prisma.alert_rules.count({ where: { ...ruleWhere, enabled: true } }),
      prisma.alert_history.count({
        where: {
          ...alertWhere,
          triggered_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.alert_history.count({
        where: {
          ...alertWhere,
          status: {
            in: ['triggered', 'acknowledged'],
          },
        },
      }),
      prisma.alert_history.count({
        where: {
          ...alertWhere,
          status: {
            in: ['resolved', 'auto_resolved'],
          },
          resolved_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Get alert breakdown by severity (last 24h)
    const alertsBySeverity = await prisma.alert_history.groupBy({
      by: ['severity'],
      where: {
        ...alertWhere,
        triggered_at: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      _count: {
        id: true,
      },
    });

    // Get alert breakdown by metric type (last 24h)
    const alertsByMetric = await prisma.alert_history.groupBy({
      by: ['metric_type'],
      where: {
        ...alertWhere,
        triggered_at: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      _count: {
        id: true,
      },
    });

    res.json({
      success: true,
      data: {
        rules: {
          total: totalRules,
          enabled: enabledRules,
          disabled: totalRules - enabledRules,
        },
        alerts: {
          triggered_24h: triggeredAlerts24h,
          active: activeAlerts,
          resolved_24h: resolvedAlerts24h,
          by_severity: alertsBySeverity.reduce((acc: any, item) => {
            acc[item.severity] = item._count.id;
            return acc;
          }, {}),
          by_metric: alertsByMetric.reduce((acc: any, item) => {
            acc[item.metric_type] = item._count.id;
            return acc;
          }, {}),
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Get monitoring stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monitoring statistics',
      error: error.message,
    });
  }
};

/**
 * Get recent alert history
 * GET /api/monitoring/recent-alerts
 */
export const getRecentAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { limit = 50, offset = 0, status, severity } = req.query;

    let where: any = {};

    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    if (status) {
      // Map "active" to triggered and acknowledged alerts
      if (status === 'active') {
        where.status = {
          in: ['triggered', 'acknowledged']
        };
      } else {
        where.status = status;
      }
    }

    if (severity) {
      where.severity = severity;
    }

    const alerts = await prisma.alert_history.findMany({
      where,
      include: {
        alert_rules: {
          select: {
            id: true,
            name: true,
            metric_type: true,
          },
        },
        users_alert_history_acknowledged_byTousers: {
          select: {
            id: true,
            email: true,
          },
        },
        users_alert_history_resolved_byTousers: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        triggered_at: 'desc',
      },
      skip: Number(offset),
      take: Number(limit),
    });

    const total = await prisma.alert_history.count({ where });

    res.json({
      success: true,
      data: alerts,
      pagination: {
        total,
        offset: Number(offset),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    logger.error('Get recent alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent alerts',
      error: error.message,
    });
  }
};

/**
 * Acknowledge an alert
 * PATCH /api/monitoring/alerts/:id/acknowledge
 */
export const acknowledgeAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id, id: userId } = req.user!;

    // Get alert
    const alert = await prisma.alert_history.findUnique({
      where: { id: BigInt(id) },
    });

    if (!alert) {
      res.status(404).json({ success: false, message: 'Alert not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && alert.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied to this alert' });
      return;
    }

    // Update alert status
    const updated = await prisma.alert_history.update({
      where: { id: BigInt(id) },
      data: {
        status: 'acknowledged',
        acknowledged_at: new Date(),
        acknowledged_by: userId,
      },
    });

    logger.info(`Alert ${id} acknowledged by user ${userId}`);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Acknowledge alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert',
      error: error.message,
    });
  }
};

/**
 * Resolve an alert
 * PATCH /api/monitoring/alerts/:id/resolve
 */
export const resolveAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { resolution_note } = req.body;
    const { role, company_id, id: userId } = req.user!;

    // Get alert
    const alert = await prisma.alert_history.findUnique({
      where: { id: BigInt(id) },
    });

    if (!alert) {
      res.status(404).json({ success: false, message: 'Alert not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && alert.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied to this alert' });
      return;
    }

    // Update alert status
    const updated = await prisma.alert_history.update({
      where: { id: BigInt(id) },
      data: {
        status: 'resolved',
        resolved_at: new Date(),
        resolved_by: userId,
        resolution_note: resolution_note || 'Manually resolved',
      },
    });

    logger.info(`Alert ${id} resolved by user ${userId}`);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Resolve alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve alert',
      error: error.message,
    });
  }
};

// Import prisma at the top
import prisma from '../config/database';
