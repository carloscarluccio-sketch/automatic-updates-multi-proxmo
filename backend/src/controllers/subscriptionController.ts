import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * List all subscription plans
 * GET /api/subscriptions/plans
 */
export const listPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const { is_active } = req.query;

    const where: any = {};
    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }

    const plans = await prisma.subscription_plans.findMany({
      where,
      orderBy: [
        { display_order: 'asc' },
        { price: 'asc' }
      ]
    });

    res.json({ success: true, data: plans });
  } catch (error: any) {
    logger.error('List subscription plans error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subscription plans' });
  }
};

/**
 * Get single subscription plan
 * GET /api/subscriptions/plans/:id
 */
export const getPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const planId = parseInt(req.params.id);

    const plan = await prisma.subscription_plans.findUnique({
      where: { id: planId },
      include: {
        _count: {
          select: { company_subscriptions: true }
        }
      }
    });

    if (!plan) {
      res.status(404).json({ success: false, message: 'Subscription plan not found' });
      return;
    }

    res.json({ success: true, data: plan });
  } catch (error: any) {
    logger.error('Get subscription plan error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subscription plan' });
  }
};

/**
 * Get company subscription
 * GET /api/subscriptions/company/:companyId
 */
export const getCompanySubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const companyId = parseInt(req.params.companyId);

    if (user.role !== 'super_admin' && user.company_id !== companyId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const subscription = await prisma.company_subscriptions.findFirst({
      where: { company_id: companyId },
      include: { subscription_plans: true },
      orderBy: { created_at: 'desc' }
    });

    if (!subscription) {
      res.status(404).json({ success: false, message: 'No active subscription found' });
      return;
    }

    res.json({ success: true, data: subscription });
  } catch (error: any) {
    logger.error('Get company subscription error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subscription' });
  }
};

/**
 * Subscribe company to plan
 * POST /api/subscriptions/subscribe
 */
export const subscribeCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { company_id, plan_id } = req.body;

    if (!plan_id) {
      res.status(400).json({ success: false, message: 'Plan ID is required' });
      return;
    }

    const targetCompanyId = user.role === 'super_admin' && company_id ? company_id : user.company_id;

    const plan = await prisma.subscription_plans.findUnique({ where: { id: plan_id } });

    if (!plan) {
      res.status(404).json({ success: false, message: 'Subscription plan not found' });
      return;
    }

    if (!plan.is_active) {
      res.status(400).json({ success: false, message: 'This plan is no longer available' });
      return;
    }

    const startDate = new Date();
    const endDate = new Date();

    if (plan.billing_period === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else if (plan.billing_period === 'quarterly') {
      endDate.setMonth(endDate.getMonth() + 3);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const existingSubscription = await prisma.company_subscriptions.findFirst({
      where: { company_id: targetCompanyId, status: 'active' }
    });

    if (existingSubscription) {
      await prisma.company_subscriptions.update({
        where: { id: existingSubscription.id },
        data: { status: 'cancelled', cancelled_at: new Date() }
      });
    }

    const subscription = await prisma.company_subscriptions.create({
      data: {
        company_id: targetCompanyId,
        plan_id,
        status: 'active',
        current_period_start: startDate,
        current_period_end: endDate
      },
      include: { subscription_plans: true }
    });

    await prisma.activity_logs.create({
      data: {
        user_id: user.id,
        company_id: targetCompanyId,
        activity_type: 'subscription',
        entity_type: 'subscription',
        entity_id: subscription.id,
        action: 'subscription_created',
        description: `Subscribed to "${plan.name}"`,
        status: 'success'
      }
    });

    res.json({ success: true, data: subscription });
  } catch (error: any) {
    logger.error('Subscribe company error:', error);
    res.status(500).json({ success: false, message: 'Failed to create subscription' });
  }
};

/**
 * Cancel subscription
 * PATCH /api/subscriptions/:id/cancel
 */
export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const subscriptionId = parseInt(req.params.id);

    const subscription = await prisma.company_subscriptions.findUnique({
      where: { id: subscriptionId },
      include: { subscription_plans: true }
    });

    if (!subscription) {
      res.status(404).json({ success: false, message: 'Subscription not found' });
      return;
    }

    if (user.role !== 'super_admin' && subscription.company_id !== user.company_id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const updatedSubscription = await prisma.company_subscriptions.update({
      where: { id: subscriptionId },
      data: { status: 'cancelled', cancelled_at: new Date(), cancel_at_period_end: true }
    });

    await prisma.activity_logs.create({
      data: {
        user_id: user.id,
        company_id: subscription.company_id,
        activity_type: 'subscription',
        entity_type: 'subscription',
        entity_id: subscriptionId,
        action: 'subscription_cancelled',
        description: `Cancelled subscription to "${subscription.subscription_plans.name}"`,
        status: 'success'
      }
    });

    res.json({ success: true, data: updatedSubscription });
  } catch (error: any) {
    logger.error('Cancel subscription error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel subscription' });
  }
};

/**
 * Get subscription statistics
 * GET /api/subscriptions/stats
 */
export const getSubscriptionStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    const where: any = {};
    if (user.role !== 'super_admin') {
      where.company_id = user.company_id;
    }

    const [totalSubscriptions, activeSubscriptions, cancelledSubscriptions] = await Promise.all([
      prisma.company_subscriptions.count({ where }),
      prisma.company_subscriptions.count({ where: { ...where, status: 'active' } }),
      prisma.company_subscriptions.count({ where: { ...where, status: 'cancelled' } })
    ]);

    const stats = {
      total_subscriptions: totalSubscriptions,
      active_subscriptions: activeSubscriptions,
      cancelled_subscriptions: cancelledSubscriptions
    };

    res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Get subscription stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
};

// Placeholder exports for admin functions (to be implemented later)

/**
 * Create subscription plan
 * POST /api/subscriptions/plans
 */
export const createPlanActual = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied. Super admin only.' });
      return;
    }

    const { name, description, price, currency, billing_period, trial_days, is_active, features, display_order } = req.body;

    if (!name || price === undefined) {
      res.status(400).json({ success: false, message: 'Name and price are required' });
      return;
    }

    const plan = await prisma.subscription_plans.create({
      data: {
        name,
        description: description || null,
        price,
        currency: currency || 'USD',
        billing_period: billing_period || 'monthly',
        trial_days: trial_days || 0,
        is_active: is_active !== undefined ? is_active : true,
        features: features || null,
        display_order: display_order || 0
      }
    });

    logger.info(`Subscription plan created: ${plan.name} by user ${user.id}`);
    res.status(201).json({ success: true, data: plan, message: 'Subscription plan created successfully' });
  } catch (error: any) {
    logger.error('Create subscription plan error:', error);
    res.status(500).json({ success: false, message: 'Failed to create subscription plan' });
  }
};

/**
 * Update subscription plan
 * PATCH /api/subscriptions/plans/:id
 */
export const updatePlanActual = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied. Super admin only.' });
      return;
    }

    const planId = parseInt(req.params.id);
    const { name, description, price, currency, billing_period, trial_days, is_active, features, display_order } = req.body;

    const plan = await prisma.subscription_plans.update({
      where: { id: planId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(currency !== undefined && { currency }),
        ...(billing_period !== undefined && { billing_period }),
        ...(trial_days !== undefined && { trial_days }),
        ...(is_active !== undefined && { is_active }),
        ...(features !== undefined && { features }),
        ...(display_order !== undefined && { display_order })
      }
    });

    logger.info(`Subscription plan updated: ${plan.name} by user ${user.id}`);
    res.json({ success: true, data: plan, message: 'Subscription plan updated successfully' });
  } catch (error: any) {
    logger.error('Update subscription plan error:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Subscription plan not found' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to update subscription plan' });
    }
  }
};

/**
 * Delete subscription plan
 * DELETE /api/subscriptions/plans/:id
 */
export const deletePlanActual = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied. Super admin only.' });
      return;
    }

    const planId = parseInt(req.params.id);

    // Check if plan has active subscriptions
    const subscriptionCount = await prisma.company_subscriptions.count({
      where: { plan_id: planId, status: 'active' }
    });

    if (subscriptionCount > 0) {
      res.status(400).json({ 
        success: false, 
        message: `Cannot delete plan with ${subscriptionCount} active subscription(s). Consider deactivating it instead.`
      });
      return;
    }

    await prisma.subscription_plans.delete({
      where: { id: planId }
    });

    logger.info(`Subscription plan deleted: ID ${planId} by user ${user.id}`);
    res.json({ success: true, message: 'Subscription plan deleted successfully' });
  } catch (error: any) {
    logger.error('Delete subscription plan error:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Subscription plan not found' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to delete subscription plan' });
    }
  }
};

// Export renamed functions
export const createPlan = createPlanActual;
export const updatePlan = updatePlanActual;
export const deletePlan = deletePlanActual;

