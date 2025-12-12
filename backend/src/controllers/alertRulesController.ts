import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    company_id?: number;
  };
}

// Get all alert rules with filtering
export const getAlertRules = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { enabled, severity, target_type, metric_type } = req.query;

    let where: any = {};

    // Company filtering
    if (role !== 'super_admin') {
      where.company_id = company_id;
    }

    // Apply filters
    if (enabled !== undefined) {
      where.enabled = enabled === 'true';
    }

    if (severity) {
      where.severity = severity;
    }

    if (target_type) {
      where.target_type = target_type;
    }

    if (metric_type) {
      where.metric_type = metric_type;
    }

    const rules = await prisma.alert_rules.findMany({
      where,
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
          },
        },
        alert_history: {
          take: 5,
          orderBy: {
            triggered_at: 'desc',
          },
          select: {
            id: true,
            triggered_at: true,
            resolved_at: true,
            status: true,
            current_value: true,
            threshold_value: true,
            message: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('Error fetching alert rules:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch alert rules' });
  }
};

// Get single alert rule
export const getAlertRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    const rule = await prisma.alert_rules.findUnique({
      where: { id: parseInt(id) },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
          },
        },
        alert_history: {
          take: 10,
          orderBy: {
            triggered_at: 'desc',
          },
        },
      },
    });

    if (!rule) {
      res.status(404).json({ success: false, message: 'Alert rule not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && rule.company_id !== company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    res.json({ success: true, data: rule });
  } catch (error) {
    console.error('Error fetching alert rule:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch alert rule' });
  }
};

// Create alert rule
export const createAlertRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id: user_company_id, id: user_id } = req.user!;
    const {
      target_company_id,
      name,
      description,
      rule_type,
      metric_type,
      condition_operator,
      threshold_value,
      duration_minutes,
      severity,
      target_type,
      target_id,
      enabled,
      notify_email,
      notify_slack,
      notify_webhook,
      notify_sms,
      notification_channels,
      cooldown_minutes,
    } = req.body;

    // Validation
    if (!name || !metric_type || !condition_operator || threshold_value === undefined || !target_type) {
      res.status(400).json({
        success: false,
        message: 'Name, metric type, condition operator, threshold value, and target type are required',
      });
      return;
    }

    // Determine company_id
    let company_id: number | null = null;
    if (role === 'super_admin') {
      company_id = target_company_id || null;
    } else {
      company_id = user_company_id!;
    }

    // If company is specified, verify it exists
    if (company_id) {
      const company = await prisma.companies.findUnique({
        where: { id: company_id },
      });

      if (!company) {
        res.status(400).json({ success: false, message: 'Invalid company' });
        return;
      }
    }

    // Verify target exists if target_id is provided
    if (target_id) {
      const targetExists = await verifyTarget(target_type, target_id);
      if (!targetExists) {
        res.status(400).json({ success: false, message: `Invalid ${target_type} target` });
        return;
      }
    }

    const ruleData: any = {
      name,
      description: description || null,
      company_id,
      rule_type: rule_type || 'threshold',
      metric_type,
      condition_operator,
      threshold_value: parseFloat(threshold_value),
      duration_minutes: duration_minutes || 5,
      severity: severity || 'warning',
      target_type,
      target_id: target_id || null,
      enabled: enabled !== undefined ? enabled : true,
      notify_email: notify_email !== undefined ? notify_email : true,
      notify_slack: notify_slack || false,
      notify_webhook: notify_webhook || false,
      notify_sms: notify_sms || false,
      notification_channels: notification_channels || null,
      cooldown_minutes: cooldown_minutes || 60,
      created_by: user_id,
    };

    const newRule = await prisma.alert_rules.create({
      data: ruleData,
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({ success: true, data: newRule });
  } catch (error) {
    console.error('Error creating alert rule:', error);
    res.status(500).json({ success: false, message: 'Failed to create alert rule' });
  }
};

// Update alert rule
export const updateAlertRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id: user_company_id } = req.user!;
    const {
      name,
      description,
      rule_type,
      metric_type,
      condition_operator,
      threshold_value,
      duration_minutes,
      severity,
      target_type,
      target_id,
      enabled,
      notify_email,
      notify_slack,
      notify_webhook,
      notify_sms,
      notification_channels,
      cooldown_minutes,
    } = req.body;

    const existingRule = await prisma.alert_rules.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        company_id: true,
        name: true,
      },
    });

    if (!existingRule) {
      res.status(404).json({ success: false, message: 'Alert rule not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && existingRule.company_id !== user_company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Verify target if provided
    if (target_id && target_type) {
      const targetExists = await verifyTarget(target_type, target_id);
      if (!targetExists) {
        res.status(400).json({ success: false, message: `Invalid ${target_type} target` });
        return;
      }
    }

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (rule_type !== undefined) updateData.rule_type = rule_type;
    if (metric_type !== undefined) updateData.metric_type = metric_type;
    if (condition_operator !== undefined) updateData.condition_operator = condition_operator;
    if (threshold_value !== undefined) updateData.threshold_value = parseFloat(threshold_value);
    if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes;
    if (severity !== undefined) updateData.severity = severity;
    if (target_type !== undefined) updateData.target_type = target_type;
    if (target_id !== undefined) updateData.target_id = target_id;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (notify_email !== undefined) updateData.notify_email = notify_email;
    if (notify_slack !== undefined) updateData.notify_slack = notify_slack;
    if (notify_webhook !== undefined) updateData.notify_webhook = notify_webhook;
    if (notify_sms !== undefined) updateData.notify_sms = notify_sms;
    if (notification_channels !== undefined) updateData.notification_channels = notification_channels;
    if (cooldown_minutes !== undefined) updateData.cooldown_minutes = cooldown_minutes;

    const updatedRule = await prisma.alert_rules.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    res.json({ success: true, data: updatedRule });
  } catch (error) {
    console.error('Error updating alert rule:', error);
    res.status(500).json({ success: false, message: 'Failed to update alert rule' });
  }
};

// Delete alert rule
export const deleteAlertRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id: user_company_id } = req.user!;

    const existingRule = await prisma.alert_rules.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        company_id: true,
        name: true,
      },
    });

    if (!existingRule) {
      res.status(404).json({ success: false, message: 'Alert rule not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && existingRule.company_id !== user_company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    await prisma.alert_rules.delete({
      where: { id: parseInt(id) },
    });

    res.json({ success: true, message: 'Alert rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert rule:', error);
    res.status(500).json({ success: false, message: 'Failed to delete alert rule' });
  }
};

// Toggle enabled status
export const toggleEnabled = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id: user_company_id } = req.user!;

    const existingRule = await prisma.alert_rules.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        company_id: true,
        enabled: true,
      },
    });

    if (!existingRule) {
      res.status(404).json({ success: false, message: 'Alert rule not found' });
      return;
    }

    // Permission check
    if (role !== 'super_admin' && existingRule.company_id !== user_company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const updatedRule = await prisma.alert_rules.update({
      where: { id: parseInt(id) },
      data: {
        enabled: !existingRule.enabled,
      },
    });

    res.json({ success: true, data: updatedRule });
  } catch (error) {
    console.error('Error toggling alert rule:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle alert rule' });
  }
};

// Get available targets for dropdown
export const getAvailableTargets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const { target_type } = req.query;

    let targets: any[] = [];

    if (!target_type) {
      res.status(400).json({ success: false, message: 'target_type is required' });
      return;
    }

    switch (target_type) {
      case 'vm':
        if (role === 'super_admin') {
          targets = await prisma.virtual_machines.findMany({
            where: { deleted_at: null },
            select: {
              id: true,
              name: true,
              vmid: true,
              node: true,
              status: true,
              company_id: true,
              companies: {
                select: {
                  name: true,
                },
              },
            },
          });
        } else {
          targets = await prisma.virtual_machines.findMany({
            where: {
              company_id: company_id,
              deleted_at: null,
            },
            select: {
              id: true,
              name: true,
              vmid: true,
              node: true,
              status: true,
            },
          });
        }
        break;

      case 'cluster':
        if (role === 'super_admin') {
          targets = await prisma.proxmox_clusters.findMany({
            select: {
              id: true,
              name: true,
              host: true,
              port: true,
            },
          });
        } else {
          targets = await prisma.company_clusters.findMany({
            where: { company_id: company_id },
            select: {
              cluster_id: true,
              proxmox_clusters: {
                select: {
                  id: true,
                  name: true,
                  host: true,
                },
              },
            },
          });
          targets = targets.map((cc: any) => ({
            id: cc.cluster_id,
            ...cc.proxmox_clusters,
          }));
        }
        break;

      case 'company':
        if (role === 'super_admin') {
          targets = await prisma.companies.findMany({
            select: {
              id: true,
              name: true,
              status: true,
            },
          });
        } else {
          const company = await prisma.companies.findUnique({
            where: { id: company_id },
            select: {
              id: true,
              name: true,
              status: true,
            },
          });
          targets = company ? [company] : [];
        }
        break;

      default:
        res.status(400).json({ success: false, message: 'Invalid target type' });
        return;
    }

    res.json({ success: true, data: targets });
  } catch (error) {
    console.error('Error fetching available targets:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch available targets' });
  }
};

// Helper function to verify target exists
async function verifyTarget(target_type: string, target_id: number): Promise<boolean> {
  try {
    switch (target_type) {
      case 'vm':
        const vm = await prisma.virtual_machines.findUnique({
          where: { id: target_id },
        });
        return !!vm;

      case 'cluster':
        const cluster = await prisma.proxmox_clusters.findUnique({
          where: { id: target_id },
        });
        return !!cluster;

      case 'node':
        // Node validation would require checking Proxmox API
        return true;

      case 'company':
        const company = await prisma.companies.findUnique({
          where: { id: target_id },
        });
        return !!company;

      default:
        return false;
    }
  } catch (error) {
    console.error('Error verifying target:', error);
    return false;
  }
}
