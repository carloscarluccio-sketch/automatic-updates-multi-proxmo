import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import axios from 'axios';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Webhook Event Types
 */
export const WEBHOOK_EVENTS = {
  VM_CREATED: 'vm.created',
  VM_DELETED: 'vm.deleted',
  VM_STARTED: 'vm.started',
  VM_STOPPED: 'vm.stopped',
  VM_RESTARTED: 'vm.restarted',
  TICKET_CREATED: 'ticket.created',
  TICKET_UPDATED: 'ticket.updated',
  TICKET_CLOSED: 'ticket.closed',
  USER_CREATED: 'user.created',
  COMPANY_CREATED: 'company.created',
  BACKUP_COMPLETED: 'backup.completed',
  BACKUP_FAILED: 'backup.failed',
  SNAPSHOT_CREATED: 'snapshot.created',
  ALERT_TRIGGERED: 'alert.triggered',
  INVOICE_CREATED: 'invoice.created',
  PAYMENT_RECEIVED: 'payment.received'
};

/**
 * Generate webhook signature for security
 */
function generateSignature(payload: any, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Deliver webhook with retry logic
 */
async function deliverWebhook(
  webhook: any,
  eventType: string,
  payload: any
): Promise<{ success: boolean; statusCode?: number; error?: string; responseBody?: string }> {
  const maxRetries = 3;
  let attempt = 0;

  // Generate signature
  const signature = webhook.secret ? generateSignature(payload, webhook.secret) : null;

  const webhookPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    webhook_id: webhook.id,
    data: payload
  };

  while (attempt < maxRetries) {
    try {
      const headers: any = {
        'Content-Type': 'application/json',
        'User-Agent': 'Proxmox-MultiTenant-Webhook/1.0'
      };

      if (signature) {
        headers['X-Webhook-Signature'] = signature;
      }

      if (webhook.custom_headers) {
        Object.assign(headers, webhook.custom_headers);
      }

      const response = await axios.post(webhook.url, webhookPayload, {
        headers,
        timeout: webhook.timeout_seconds * 1000 || 30000,
        maxRedirects: 5
      });

      // Log successful delivery
      await prisma.webhook_deliveries.create({
        data: {
          webhook_id: webhook.id,
          event_type: eventType,
          payload: JSON.stringify(webhookPayload),
          response_status_code: response.status,
          response_body: JSON.stringify(response.data),
          delivery_status: 'success',
          attempts: attempt + 1,
          delivered_at: new Date()
        }
      });

      return { success: true, statusCode: response.status, responseBody: JSON.stringify(response.data) };

    } catch (error: any) {
      attempt++;

      const isLastAttempt = attempt >= maxRetries;
      const errorMessage = error.response?.data ? JSON.stringify(error.response.data) : error.message;

      if (isLastAttempt) {
        // Log failed delivery
        await prisma.webhook_deliveries.create({
          data: {
            webhook_id: webhook.id,
            event_type: eventType,
            payload: JSON.stringify(webhookPayload),
            response_status_code: error.response?.status,
            response_body: errorMessage,
            delivery_status: 'failed',
            attempts: attempt,
            error_message: errorMessage,
            delivered_at: new Date()
          }
        });

        return { success: false, statusCode: error.response?.status, error: errorMessage };
      }

      // Exponential backoff: 1s, 2s, 4s
      const backoffMs = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Trigger webhook for an event
 * Called by other parts of the application when events occur
 */
export async function triggerWebhook(
  eventType: string,
  payload: any,
  companyId?: number
): Promise<void> {
  try {
    // Find all active webhooks for this event type
    const where: any = {
      is_active: true,
      events: {
        has: eventType
      }
    };

    if (companyId) {
      where.company_id = companyId;
    }

    const webhooks = await prisma.webhooks.findMany({ where });

    // Deliver to all matching webhooks in parallel
    const deliveryPromises = webhooks.map(webhook => deliverWebhook(webhook, eventType, payload));
    await Promise.allSettled(deliveryPromises);

  } catch (error: any) {
    logger.error('Trigger webhook error:', error);
  }
}

/**
 * List webhooks
 * GET /api/webhooks
 */
export const listWebhooks = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    const where: any = {};
    if (user.role !== 'super_admin') {
      where.company_id = user.company_id;
    }

    const webhooks = await prisma.webhooks.findMany({
      where,
      include: {
        companies: {
          select: { id: true, name: true }
        },
        users: {
          select: { id: true, username: true, email: true }
        },
        _count: {
          select: { webhook_deliveries: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({ success: true, data: webhooks });
  } catch (error: any) {
    logger.error('List webhooks error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch webhooks' });
  }
};

/**
 * Get single webhook
 * GET /api/webhooks/:id
 */
export const getWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const webhookId = parseInt(req.params.id);

    const webhook = await prisma.webhooks.findUnique({
      where: { id: webhookId },
      include: {
        companies: {
          select: { id: true, name: true }
        },
        users: {
          select: { id: true, username: true }
        },
        webhook_deliveries: {
          orderBy: { delivered_at: 'desc' },
          take: 50
        }
      }
    });

    if (!webhook) {
      res.status(404).json({ success: false, message: 'Webhook not found' });
      return;
    }

    // Check access
    if (user.role !== 'super_admin' && webhook.company_id !== user.company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    res.json({ success: true, data: webhook });
  } catch (error: any) {
    logger.error('Get webhook error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch webhook' });
  }
};

/**
 * Create webhook
 * POST /api/webhooks
 */
export const createWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { name, url, events, secret, custom_headers, timeout_seconds, company_id } = req.body;

    // Validate required fields
    if (!name || !url || !events || events.length === 0) {
      res.status(400).json({ success: false, message: 'Name, URL, and events are required' });
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      res.status(400).json({ success: false, message: 'Invalid URL format' });
      return;
    }

    // Validate events
    const validEvents = Object.values(WEBHOOK_EVENTS);
    const invalidEvents = events.filter((e: string) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      res.status(400).json({ success: false, message: `Invalid events: ${invalidEvents.join(', ')}` });
      return;
    }

    // Determine company
    const targetCompanyId = user.role === 'super_admin' && company_id ? company_id : user.company_id;

    const webhook = await prisma.webhooks.create({
      data: {
        name,
        url,
        events,
        secret,
        custom_headers,
        timeout_seconds: timeout_seconds || 30,
        company_id: targetCompanyId,
        created_by: user.id,
        is_active: true
      }
    });

    // Log activity
    await prisma.activity_logs.create({
      data: {
        user_id: user.id,
        company_id: targetCompanyId,
        activity_type: 'webhook',
        entity_type: 'webhook',
        entity_id: webhook.id,
        action: 'webhook_created',
        description: `Webhook "${name}" created for events: ${events.join(', ')}`,
        status: 'success'
      }
    });

    res.json({ success: true, data: webhook });
  } catch (error: any) {
    logger.error('Create webhook error:', error);
    res.status(500).json({ success: false, message: 'Failed to create webhook' });
  }
};

/**
 * Update webhook
 * PATCH /api/webhooks/:id
 */
export const updateWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const webhookId = parseInt(req.params.id);
    const { name, url, events, secret, custom_headers, timeout_seconds, is_active } = req.body;

    // Check webhook exists and user has access
    const webhook = await prisma.webhooks.findUnique({
      where: { id: webhookId }
    });

    if (!webhook) {
      res.status(404).json({ success: false, message: 'Webhook not found' });
      return;
    }

    if (user.role !== 'super_admin' && webhook.company_id !== user.company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        res.status(400).json({ success: false, message: 'Invalid URL format' });
        return;
      }
    }

    // Validate events if provided
    if (events) {
      const validEvents = Object.values(WEBHOOK_EVENTS);
      const invalidEvents = events.filter((e: string) => !validEvents.includes(e));
      if (invalidEvents.length > 0) {
        res.status(400).json({ success: false, message: `Invalid events: ${invalidEvents.join(', ')}` });
        return;
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (url !== undefined) updateData.url = url;
    if (events !== undefined) updateData.events = events;
    if (secret !== undefined) updateData.secret = secret;
    if (custom_headers !== undefined) updateData.custom_headers = custom_headers;
    if (timeout_seconds !== undefined) updateData.timeout_seconds = timeout_seconds;
    if (is_active !== undefined) updateData.is_active = is_active;

    const updatedWebhook = await prisma.webhooks.update({
      where: { id: webhookId },
      data: updateData
    });

    // Log activity
    await prisma.activity_logs.create({
      data: {
        user_id: user.id,
        company_id: webhook.company_id,
        activity_type: 'webhook',
        entity_type: 'webhook',
        entity_id: webhookId,
        action: 'webhook_updated',
        description: `Webhook "${webhook.name}" updated`,
        status: 'success'
      }
    });

    res.json({ success: true, data: updatedWebhook });
  } catch (error: any) {
    logger.error('Update webhook error:', error);
    res.status(500).json({ success: false, message: 'Failed to update webhook' });
  }
};

/**
 * Delete webhook
 * DELETE /api/webhooks/:id
 */
export const deleteWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const webhookId = parseInt(req.params.id);

    // Check webhook exists and user has access
    const webhook = await prisma.webhooks.findUnique({
      where: { id: webhookId }
    });

    if (!webhook) {
      res.status(404).json({ success: false, message: 'Webhook not found' });
      return;
    }

    if (user.role !== 'super_admin' && webhook.company_id !== user.company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    await prisma.webhooks.delete({
      where: { id: webhookId }
    });

    // Log activity
    await prisma.activity_logs.create({
      data: {
        user_id: user.id,
        company_id: webhook.company_id,
        activity_type: 'webhook',
        entity_type: 'webhook',
        entity_id: webhookId,
        action: 'webhook_deleted',
        description: `Webhook "${webhook.name}" deleted`,
        status: 'success'
      }
    });

    res.json({ success: true, message: 'Webhook deleted successfully' });
  } catch (error: any) {
    logger.error('Delete webhook error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete webhook' });
  }
};

/**
 * Test webhook (send test payload)
 * POST /api/webhooks/:id/test
 */
export const testWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const webhookId = parseInt(req.params.id);

    // Check webhook exists and user has access
    const webhook = await prisma.webhooks.findUnique({
      where: { id: webhookId }
    });

    if (!webhook) {
      res.status(404).json({ success: false, message: 'Webhook not found' });
      return;
    }

    if (user.role !== 'super_admin' && webhook.company_id !== user.company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Send test payload
    const testPayload = {
      test: true,
      message: 'This is a test webhook delivery',
      webhook_id: webhook.id,
      webhook_name: webhook.name,
      timestamp: new Date().toISOString()
    };

    const result = await deliverWebhook(webhook, 'webhook.test', testPayload);

    res.json({
      success: result.success,
      data: {
        statusCode: result.statusCode,
        error: result.error,
        responseBody: result.responseBody
      }
    });
  } catch (error: any) {
    logger.error('Test webhook error:', error);
    res.status(500).json({ success: false, message: 'Failed to test webhook' });
  }
};

/**
 * Get webhook delivery history
 * GET /api/webhooks/:id/deliveries
 */
export const getWebhookDeliveries = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const webhookId = parseInt(req.params.id);
    const { limit = 50, status } = req.query;

    // Check webhook exists and user has access
    const webhook = await prisma.webhooks.findUnique({
      where: { id: webhookId }
    });

    if (!webhook) {
      res.status(404).json({ success: false, message: 'Webhook not found' });
      return;
    }

    if (user.role !== 'super_admin' && webhook.company_id !== user.company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const where: any = { webhook_id: webhookId };
    if (status) {
      where.delivery_status = status;
    }

    const deliveries = await prisma.webhook_deliveries.findMany({
      where,
      orderBy: { delivered_at: 'desc' },
      take: parseInt(limit as string)
    });

    res.json({ success: true, data: deliveries });
  } catch (error: any) {
    logger.error('Get webhook deliveries error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deliveries' });
  }
};

/**
 * Get webhook statistics
 * GET /api/webhooks/stats
 */
export const getWebhookStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    const where: any = {};
    if (user.role !== 'super_admin') {
      where.company_id = user.company_id;
    }

    const [totalWebhooks, activeWebhooks, totalDeliveries, successfulDeliveries, failedDeliveries] = await Promise.all([
      prisma.webhooks.count({ where }),
      prisma.webhooks.count({ where: { ...where, is_active: true } }),
      prisma.webhook_deliveries.count({
        where: {
          webhooks: where.company_id ? { company_id: where.company_id } : undefined
        }
      }),
      prisma.webhook_deliveries.count({
        where: {
          delivery_status: 'success',
          webhooks: where.company_id ? { company_id: where.company_id } : undefined
        }
      }),
      prisma.webhook_deliveries.count({
        where: {
          delivery_status: 'failed',
          webhooks: where.company_id ? { company_id: where.company_id } : undefined
        }
      })
    ]);

    const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

    const stats = {
      total_webhooks: totalWebhooks,
      active_webhooks: activeWebhooks,
      inactive_webhooks: totalWebhooks - activeWebhooks,
      total_deliveries: totalDeliveries,
      successful_deliveries: successfulDeliveries,
      failed_deliveries: failedDeliveries,
      success_rate: parseFloat(successRate.toFixed(2))
    };

    res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Get webhook stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
};
