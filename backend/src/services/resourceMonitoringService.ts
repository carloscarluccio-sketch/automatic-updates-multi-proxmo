import prisma from '../config/database';
import logger from '../utils/logger';
import emailService from './emailNotificationService';

/**
 * Resource Monitoring Service
 *
 * Monitors VM resource metrics and triggers alerts based on configured rules
 * Should be run periodically via cron job or scheduler
 */

interface AlertRule {
  id: number;
  name: string;
  company_id: number | null;
  metric_type: string;
  condition_operator: string;
  threshold_value: any;
  duration_minutes: number | null;
  severity: string | null;
  target_type: string;
  target_id: number | null;
  cooldown_minutes: number | null;
  notify_email: boolean | null;
  notify_slack: boolean | null;
  notify_webhook: boolean | null;
  notification_channels: any;
}

/**
 * Main monitoring function - checks all enabled alert rules
 */
export async function monitorResourceAlerts(): Promise<void> {
  try {
    logger.info('Starting resource alert monitoring cycle');

    // Get all enabled alert rules
    const rules = await prisma.alert_rules.findMany({
      where: {
        enabled: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    logger.info(`Found ${rules.length} enabled alert rules to check`);

    let triggeredCount = 0;
    let skippedCount = 0;

    for (const rule of rules) {
      try {
        const triggered = await checkAlertRule(rule);
        if (triggered) {
          triggeredCount++;
        } else {
          skippedCount++;
        }
      } catch (error: any) {
        logger.error(`Error checking alert rule ${rule.id}:`, error.message);
      }
    }

    logger.info(`Alert monitoring cycle complete: ${triggeredCount} triggered, ${skippedCount} skipped`);
  } catch (error: any) {
    logger.error('Resource monitoring error:', error);
  }
}

/**
 * Check a single alert rule against current metrics
 */
async function checkAlertRule(rule: AlertRule): Promise<boolean> {
  // Check cooldown period - don't trigger if recently triggered
  if (await isInCooldown(rule)) {
    logger.debug(`Alert rule ${rule.id} (${rule.name}) is in cooldown period`);
    return false;
  }

  // Get targets to monitor based on rule target_type
  const targets = await getMonitoringTargets(rule);

  if (targets.length === 0) {
    logger.debug(`No targets found for alert rule ${rule.id}`);
    return false;
  }

  let alertTriggered = false;

  for (const target of targets) {
    const shouldTrigger = await evaluateTarget(rule, target);
    if (shouldTrigger) {
      await triggerAlert(rule, target);
      alertTriggered = true;
    }
  }

  return alertTriggered;
}

/**
 * Check if alert is in cooldown period
 */
async function isInCooldown(rule: AlertRule): Promise<boolean> {
  const cooldownMinutes = rule.cooldown_minutes || 60;
  const cooldownThreshold = new Date(Date.now() - cooldownMinutes * 60 * 1000);

  const recentAlert = await prisma.alert_history.findFirst({
    where: {
      alert_rule_id: rule.id,
      triggered_at: {
        gte: cooldownThreshold,
      },
      status: {
        in: ['triggered', 'acknowledged'],
      },
    },
    orderBy: {
      triggered_at: 'desc',
    },
  });

  return recentAlert !== null;
}

/**
 * Get monitoring targets based on rule target_type
 */
async function getMonitoringTargets(rule: AlertRule): Promise<any[]> {
  switch (rule.target_type) {
    case 'vm':
      if (rule.target_id) {
        // Specific VM
        const vm = await prisma.virtual_machines.findUnique({
          where: { id: rule.target_id },
          select: { id: true, name: true, vmid: true, company_id: true, status: true },
        });
        return vm ? [{ ...vm, target_type: 'vm' }] : [];
      } else {
        // All VMs in company
        const where: any = {};
        if (rule.company_id) {
          where.company_id = rule.company_id;
        }
        const vms = await prisma.virtual_machines.findMany({
          where,
          select: { id: true, name: true, vmid: true, company_id: true, status: true },
        });
        return vms.map((vm) => ({ ...vm, target_type: 'vm' }));
      }

    case 'cluster':
      if (rule.target_id) {
        const cluster = await prisma.proxmox_clusters.findUnique({
          where: { id: rule.target_id },
          select: { id: true, name: true },
        });
        return cluster ? [{ ...cluster, target_type: 'cluster' }] : [];
      }
      return [];

    case 'company':
      if (rule.target_id) {
        const company = await prisma.companies.findUnique({
          where: { id: rule.target_id },
          select: { id: true, name: true },
        });
        return company ? [{ ...company, target_type: 'company' }] : [];
      }
      return [];

    default:
      return [];
  }
}

/**
 * Evaluate if target meets alert threshold
 */
async function evaluateTarget(rule: AlertRule, target: any): Promise<boolean> {
  if (target.target_type === 'vm') {
    return await evaluateVMMetrics(rule, target.id);
  }

  // For cluster and company targets, would need aggregate metrics
  // Not implemented in this version
  return false;
}

/**
 * Evaluate VM metrics against rule threshold
 */
async function evaluateVMMetrics(rule: AlertRule, vmId: number): Promise<boolean> {
  const durationMinutes = rule.duration_minutes || 5;
  const thresholdTime = new Date(Date.now() - durationMinutes * 60 * 1000);

  // Get recent metrics within duration window
  const metrics = await prisma.vm_resource_metrics.findMany({
    where: {
      vm_id: vmId,
      collected_at: {
        gte: thresholdTime,
      },
    },
    orderBy: {
      collected_at: 'desc',
    },
    take: 10, // Sample last 10 data points
  });

  if (metrics.length === 0) {
    return false;
  }

  // Get metric value based on rule metric_type
  const values = metrics.map((m) => getMetricValue(m, rule.metric_type));

  // Check if ALL samples in duration exceed threshold (consistent breach)
  return values.every((value) =>
    evaluateCondition(value, rule.condition_operator, Number(rule.threshold_value))
  );
}

/**
 * Extract metric value from metrics record
 */
function getMetricValue(metrics: any, metricType: string): number {
  switch (metricType) {
    case 'cpu':
      return Number(metrics.cpu_usage_percent || 0);
    case 'memory':
      return Number(metrics.memory_percent || 0);
    case 'disk':
      return Number(metrics.disk_used_gb || 0);
    case 'network':
      return Number(metrics.network_in_bytes || 0) + Number(metrics.network_out_bytes || 0);
    case 'uptime':
      return Number(metrics.uptime_seconds || 0);
    default:
      return 0;
  }
}

/**
 * Evaluate condition (>, <, >=, <=, ==, !=)
 */
function evaluateCondition(current: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>':
      return current > threshold;
    case '<':
      return current < threshold;
    case '>=':
      return current >= threshold;
    case '<=':
      return current <= threshold;
    case '==':
      return current === threshold;
    case '!=':
      return current !== threshold;
    default:
      return false;
  }
}

/**
 * Trigger alert and create history entry
 */
/**
 * Send webhook notification for alert
 */
async function sendWebhookNotification(
  rule: any,
  target: any,
  currentValue: number,
  message: string
): Promise<void> {
  try {
    // Get company webhook URL
    const company = await prisma.companies.findUnique({
      where: { id: rule.company_id },
      select: { alert_webhook_url: true, name: true }
    });

    if (!company || !company.alert_webhook_url) {
      return; // No webhook configured
    }

    // Prepare webhook payload (Slack-compatible format)
    const payload = {
      text: `🚨 Alert: ${rule.name}`,
      attachments: [
        {
          color: rule.severity === 'critical' ? 'danger' : rule.severity === 'warning' ? 'warning' : 'good',
          fields: [
            {
              title: 'Company',
              value: company.name,
              short: true
            },
            {
              title: 'Severity',
              value: rule.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Resource',
              value: `${target.target_type}: ${target.name}`,
              short: false
            },
            {
              title: 'Metric',
              value: `${rule.metric_name} = ${currentValue.toFixed(2)}`,
              short: true
            },
            {
              title: 'Threshold',
              value: `${rule.condition_operator} ${rule.threshold_value}`,
              short: true
            },
            {
              title: 'Message',
              value: message,
              short: false
            }
          ],
          footer: 'Proxmox Multi-Tenant Platform',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    // Send webhook
    const response = await fetch(company.alert_webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      logger.info(`Webhook notification sent for alert ${rule.name}`);
    } else {
      logger.error(`Webhook notification failed: ${response.status} ${response.statusText}`);
    }
  } catch (error: any) {
    logger.error(`Error sending webhook notification:`, error);
  }
}


async function triggerAlert(rule: AlertRule, target: any): Promise<void> {
  try {
    // Get current metric value
    let currentValue = 0;
    if (target.target_type === 'vm') {
      const latestMetrics = await prisma.vm_resource_metrics.findFirst({
        where: { vm_id: target.id },
        orderBy: { collected_at: 'desc' },
      });
      if (latestMetrics) {
        currentValue = getMetricValue(latestMetrics, rule.metric_type);
      }
    }

    // Build alert message
    const message = buildAlertMessage(rule, target, currentValue);

    // Create alert history entry
    await prisma.alert_history.create({
      data: {
        alert_rule_id: rule.id,
        company_id: rule.company_id,
        target_type: target.target_type,
        target_id: target.id,
        target_name: target.name,
        severity: rule.severity as any,
        metric_type: rule.metric_type,
        current_value: currentValue,
        threshold_value: Number(rule.threshold_value),
        message,
        status: 'triggered',
        triggered_at: new Date(),
      },
    });

    logger.warn(`Alert triggered: ${rule.name} for ${target.target_type} ${target.name} (${currentValue} ${rule.condition_operator} ${rule.threshold_value})`);

    // Send email notifications if enabled
    if (rule.notify_email) {
      await sendEmailNotifications(rule, target, currentValue, message);
    }

    // Send webhook notifications if enabled
    if (rule.notify_webhook || rule.company_id) {
      await sendWebhookNotification(rule, target, currentValue, message);
    }
  } catch (error: any) {
    logger.error(`Failed to trigger alert for rule ${rule.id}:`, error.message);
  }
}

/**
 * Build human-readable alert message
 */
function buildAlertMessage(rule: AlertRule, target: any, currentValue: number): string {
  const metricLabel = getMetricLabel(rule.metric_type);
  const targetLabel = `${target.target_type} "${target.name}"`;
  const severity = rule.severity || 'warning';

  return `${severity.toUpperCase()}: ${metricLabel} on ${targetLabel} is ${currentValue.toFixed(2)} (threshold: ${rule.condition_operator} ${rule.threshold_value})`;
}

/**
 * Get human-readable metric label
 */
function getMetricLabel(metricType: string): string {
  const labels: Record<string, string> = {
    cpu: 'CPU usage',
    memory: 'Memory usage',
    disk: 'Disk usage',
    network: 'Network traffic',
    uptime: 'Uptime',
    load: 'System load',
  };
  return labels[metricType] || metricType;
}

/**
 * Auto-resolve alerts that are no longer breaching threshold
 */
export async function autoResolveAlerts(): Promise<void> {
  try {
    logger.info('Checking for alerts to auto-resolve');

    // Get all triggered or acknowledged alerts
    const activeAlerts = await prisma.alert_history.findMany({
      where: {
        status: {
          in: ['triggered', 'acknowledged'],
        },
        resolved_at: null,
      },
      include: {
        alert_rules: true,
      },
    });

    let resolvedCount = 0;

    for (const alert of activeAlerts) {
      if (!alert.alert_rules) continue;

      const rule = alert.alert_rules;
      const target = { id: alert.target_id, target_type: alert.target_type };

      const stillBreaching = await evaluateTarget(rule as any, target);

      if (!stillBreaching) {
        // Alert is no longer breaching threshold - auto-resolve
        await prisma.alert_history.update({
          where: { id: alert.id },
          data: {
            status: 'auto_resolved',
            resolved_at: new Date(),
            resolution_note: 'Metric returned to normal levels',
          },
        });

        logger.info(`Auto-resolved alert ${alert.id} for ${alert.target_name}`);
        resolvedCount++;
      }
    }

    logger.info(`Auto-resolved ${resolvedCount} alerts`);
  } catch (error: any) {
    logger.error('Auto-resolve alerts error:', error);
  }
}

/**
 * Send email notifications for triggered alerts
 */
async function sendEmailNotifications(
  rule: AlertRule,
  target: any,
  currentValue: number,
  message: string
): Promise<void> {
  try {
    const where: any = {
      role: {
        in: ['super_admin', 'company_admin'],
      },
    };

    if (rule.company_id !== null) {
      where.company_id = rule.company_id;
    }

    // Get users to notify based on company
    const usersToNotify = await prisma.users.findMany({
      where,
      select: {
        id: true,
        email: true,
      },
    });

    if (usersToNotify.length === 0) {
      logger.debug(`No users to notify for alert rule ${rule.id}`);
      return;
    }

    // Send email to each user
    for (const user of usersToNotify) {
      // Check user notification settings
      const settings = await prisma.notification_settings.findUnique({
        where: {
          user_id_notification_type: {
            user_id: user.id,
            notification_type: 'alert_triggered',
          },
        },
      });

      // Skip if user has disabled email notifications
      if (settings && !settings.email_enabled) {
        logger.debug(`User ${user.id} has disabled alert email notifications`);
        continue;
      }

      await emailService.sendAlertNotification(
        user.id,
        user.email,
        {
          ruleName: rule.name,
          severity: rule.severity || 'warning',
          targetName: target.name,
          metricType: rule.metric_type,
          currentValue,
          thresholdValue: Number(rule.threshold_value),
          message,
        }
      );
    }

    logger.info(`📧 Email notifications sent for alert: ${rule.name} (${usersToNotify.length} recipients)`);
  } catch (error: any) {
    logger.error('Failed to send email notifications:', error);
  }
}

export default {
  monitorResourceAlerts,
  autoResolveAlerts,
};
