import { Request, Response } from 'express';
import { paymentProcessor } from '../services/paymentProcessingService';
import database from '../config/database';
import logger from '../utils/logger';
import prisma from '../config/database';

/**
 * Get Stripe configuration
 * GET /api/payment/stripe/config
 * Role: super_admin
 */
export const getStripeConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const settings = await database.global_settings.findFirst({
      where: { setting_key: 'stripe_config' }
    });

    if (!settings || !settings.setting_value_json) {
      res.json({
        success: true,
        data: {
          secret_key: '',
          publishable_key: '',
          webhook_secret: ''
        }
      });
      return;
    }

    const config = JSON.parse(settings.setting_value_json as string);
    // Never send secret key to frontend
    delete config.secret_key;
    delete config.webhook_secret;

    res.json({
      success: true,
      data: config
    });

  } catch (error: any) {
    logger.error('Error getting Stripe config:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Update Stripe configuration
 * PUT /api/payment/stripe/config
 * Role: super_admin
 */
export const updateStripeConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const { secret_key, publishable_key, webhook_secret } = req.body;

    if (!secret_key || !publishable_key) {
      res.status(400).json({ success: false, message: 'Secret key and publishable key are required' });
      return;
    }

    // Get existing config to preserve secrets if not provided
    let config: any = {
      secret_key,
      publishable_key,
      webhook_secret: webhook_secret || ''
    };

    const existing = await database.global_settings.findFirst({
      where: { setting_key: 'stripe_config' }
    });

    if (existing && existing.setting_value_json) {
      const existingConfig = JSON.parse(existing.setting_value_json as string);
      // Preserve existing secret if not provided (empty string means update)
      if (!secret_key) {
        config.secret_key = existingConfig.secret_key;
      }
      if (!webhook_secret) {
        config.webhook_secret = existingConfig.webhook_secret || '';
      }
    }

    await database.global_settings.upsert({
      where: { setting_key: 'stripe_config' },
      create: {
        setting_key: 'stripe_config',
        setting_value_json: JSON.stringify(config),
        description: 'Stripe payment gateway configuration'
      },
      update: {
        setting_value_json: JSON.stringify(config),
        updated_at: new Date()
      }
    });

    logger.info('Stripe configuration updated');

    res.json({
      success: true,
      message: 'Stripe configuration updated successfully'
    });

  } catch (error: any) {
    logger.error('Error updating Stripe config:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get PayPal configuration
 * GET /api/payment/paypal/config
 * Role: super_admin
 */
export const getPayPalConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const settings = await database.global_settings.findFirst({
      where: { setting_key: 'paypal_config' }
    });

    if (!settings || !settings.setting_value_json) {
      res.json({
        success: true,
        data: {
          client_id: '',
          mode: 'sandbox'
        }
      });
      return;
    }

    const config = JSON.parse(settings.setting_value_json as string);
    // Never send client secret to frontend
    delete config.client_secret;

    res.json({
      success: true,
      data: config
    });

  } catch (error: any) {
    logger.error('Error getting PayPal config:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Update PayPal configuration
 * PUT /api/payment/paypal/config
 * Role: super_admin
 */
export const updatePayPalConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    if (user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const { client_id, client_secret, mode } = req.body;

    if (!client_id) {
      res.status(400).json({ success: false, message: 'Client ID is required' });
      return;
    }

    const config: any = {
      client_id,
      client_secret: client_secret || '',
      mode: mode || 'sandbox'
    };

    await database.global_settings.upsert({
      where: { setting_key: 'paypal_config' },
      create: {
        setting_key: 'paypal_config',
        setting_value_json: JSON.stringify(config),
        description: 'PayPal payment gateway configuration'
      },
      update: {
        setting_value_json: JSON.stringify(config),
        updated_at: new Date()
      }
    });

    logger.info('PayPal configuration updated');

    res.json({
      success: true,
      message: 'PayPal configuration updated successfully'
    });

  } catch (error: any) {
    logger.error('Error updating PayPal config:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get payment methods for a company
 * GET /api/payment/methods
 * Role: super_admin, company_admin
 */
export const getPaymentMethods = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    let companyId: number;

    if (user.role === 'super_admin') {
      companyId = parseInt(req.query.company_id as string);
      if (!companyId) {
        res.status(400).json({ success: false, message: 'Company ID required for super_admin' });
        return;
      }
    } else {
      companyId = user.company_id;
    }

    const methods = await paymentProcessor.getPaymentMethods(companyId);

    res.json({
      success: true,
      data: methods
    });

  } catch (error: any) {
    logger.error('Error getting payment methods:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Add payment method (Setup Intent)
 * POST /api/payment/methods/setup-intent
 * Role: super_admin, company_admin
 */
export const createSetupIntent = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    let companyId: number;

    if (user.role === 'super_admin') {
      companyId = parseInt(req.body.company_id);
      if (!companyId) {
        res.status(400).json({ success: false, message: 'Company ID required for super_admin' });
        return;
      }
    } else {
      companyId = user.company_id;
    }

    // Ensure company has Stripe customer
    const company = await database.companies.findUnique({
      where: { id: companyId },
      select: { id: true } // stripe_customer_id removed
    });

    if (!company?.id) { // stripe_customer_id check removed
      const result = await paymentProcessor.createStripeCustomer(companyId);
      if (!result.success) {
        res.status(500).json({ success: false, message: 'Failed to create Stripe customer' });
        return;
      }
    }

    // Initialize Stripe
    await (paymentProcessor as any).initializeStripe();
    const stripe = (paymentProcessor as any).stripe;

    if (!stripe) {
      res.status(500).json({ success: false, message: 'Stripe not configured' });
      return;
    }

    // Get customer ID again after creation
    const updatedCompany = await database.companies.findUnique({
      where: { id: companyId },
      select: { id: true } // stripe_customer_id removed
    });

    const setupIntent = await stripe.setupIntents.create({
      customer: updatedCompany!.id, // stripe_customer_id
      payment_method_types: ['card']
    });

    res.json({
      success: true,
      data: {
        client_secret: setupIntent.client_secret
      }
    });

  } catch (error: any) {
    logger.error('Error creating setup intent:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Confirm payment method after setup intent
 * POST /api/payment/methods
 * Role: super_admin, company_admin
 */
export const addPaymentMethod = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { payment_method_id, is_default } = req.body;

    if (!payment_method_id) {
      res.status(400).json({ success: false, message: 'Payment method ID is required' });
      return;
    }

    let companyId: number;
    if (user.role === 'super_admin') {
      companyId = parseInt(req.body.company_id);
      if (!companyId) {
        res.status(400).json({ success: false, message: 'Company ID required for super_admin' });
        return;
      }
    } else {
      companyId = user.company_id;
    }

    // Get payment method details from Stripe
    await (paymentProcessor as any).initializeStripe();
    const stripe = (paymentProcessor as any).stripe;

    if (!stripe) {
      res.status(500).json({ success: false, message: 'Stripe not configured' });
      return;
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(payment_method_id);

    const result = await paymentProcessor.addPaymentMethod({
      company_id: companyId,
      type: 'card',
      provider: 'stripe',
      provider_payment_method_id: payment_method_id,
      last4: paymentMethod.card?.last4,
      brand: paymentMethod.card?.brand,
      exp_month: paymentMethod.card?.exp_month,
      exp_year: paymentMethod.card?.exp_year,
      is_default: is_default || false
    });

    if (!result.success) {
      res.status(500).json({ success: false, message: result.error });
      return;
    }

    res.json({
      success: true,
      message: 'Payment method added successfully',
      data: { id: result.id }
    });

  } catch (error: any) {
    logger.error('Error adding payment method:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Delete payment method
 * DELETE /api/payment/methods/:id
 * Role: super_admin, company_admin
 */
export const deletePaymentMethod = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const methodId = parseInt(req.params.id);
    let companyId: number;

    if (user.role === 'super_admin') {
      companyId = parseInt(req.query.company_id as string);
      if (!companyId) {
        res.status(400).json({ success: false, message: 'Company ID required for super_admin' });
        return;
      }
    } else {
      companyId = user.company_id;
    }

    const result = await paymentProcessor.deletePaymentMethod(methodId, companyId);

    if (!result.success) {
      res.status(500).json({ success: false, message: result.error });
      return;
    }

    res.json({
      success: true,
      message: 'Payment method deleted successfully'
    });

  } catch (error: any) {
    logger.error('Error deleting payment method:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Set default payment method
 * PUT /api/payment/methods/:id/default
 * Role: super_admin, company_admin
 */
export const setDefaultPaymentMethod = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const // @ts-ignore
    _methodId = parseInt(req.params.id);
    let companyId: number;

    if (user.role === 'super_admin') {
      companyId = parseInt(req.body.company_id);
      if (!companyId) {
        res.status(400).json({ success: false, message: 'Company ID required for super_admin' });
        return;
      }
    } else {
      companyId = user.company_id;
    }

// Get the method ID from params
    const methodId = parseInt(req.params.id);

    // Verify the payment method exists and belongs to the company
    const existingMethod = await prisma.company_payment_methods.findFirst({
      where: {
        id: methodId,
        company_id: companyId}
    });

    if (!existingMethod) {
      res.status(404).json({ 
        success: false, 
        message: 'Payment method not found or does not belong to this company' 
      });
      return;
    }

    // Use a transaction to ensure data consistency
    await prisma.$transaction([
      // First, set all payment methods for this company to non-primary
      prisma.company_payment_methods.updateMany({
        where: {
          company_id: companyId},
        data: {
          is_primary: false
        }
      }),
      // Then, set the selected method as primary
      prisma.company_payment_methods.update({
        where: { id: methodId },
        data: {
          is_primary: true,
          updated_at: new Date()
        }
      })
    ]);

    logger.info(`Default payment method set for company ${companyId}, method ${methodId}`);

    res.json({
      success: true,
      message: 'Default payment method updated successfully'
    });

  } catch (error: any) {
    logger.error('Error setting default payment method:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Create payment intent for one-time payment
 * POST /api/payment/create-intent
 * Role: super_admin, company_admin
 */
export const createPaymentIntent = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { amount, currency, payment_method_id, description, metadata } = req.body;

    if (!amount || !currency) {
      res.status(400).json({ success: false, message: 'Amount and currency are required' });
      return;
    }

    let companyId: number;
    if (user.role === 'super_admin') {
      companyId = parseInt(req.body.company_id);
      if (!companyId) {
        res.status(400).json({ success: false, message: 'Company ID required for super_admin' });
        return;
      }
    } else {
      companyId = user.company_id;
    }

    const result = await paymentProcessor.createPaymentIntent({
      amount: parseFloat(amount),
      currency,
      company_id: companyId,
      payment_method_id,
      description,
      metadata
    });

    if (!result.success) {
      res.status(500).json({ success: false, message: result.error });
      return;
    }

    res.json({
      success: true,
      data: {
        client_secret: result.clientSecret
      }
    });

  } catch (error: any) {
    logger.error('Error creating payment intent:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Create subscription
 * POST /api/payment/subscriptions
 * Role: super_admin, company_admin
 */
export const createSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { plan_id, payment_method_id, trial_days } = req.body;

    if (!plan_id || !payment_method_id) {
      res.status(400).json({ success: false, message: 'Plan ID and payment method ID are required' });
      return;
    }

    let companyId: number;
    if (user.role === 'super_admin') {
      companyId = parseInt(req.body.company_id);
      if (!companyId) {
        res.status(400).json({ success: false, message: 'Company ID required for super_admin' });
        return;
      }
    } else {
      companyId = user.company_id;
    }

    const result = await paymentProcessor.createSubscription({
      company_id: companyId,
      plan_id: parseInt(plan_id),
      payment_method_id,
      trial_days: trial_days ? parseInt(trial_days) : undefined
    });

    if (!result.success) {
      res.status(500).json({ success: false, message: result.error });
      return;
    }

    res.json({
      success: true,
      message: 'Subscription created successfully',
      data: { subscription_id: result.subscriptionId }
    });

  } catch (error: any) {
    logger.error('Error creating subscription:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Cancel subscription
 * DELETE /api/payment/subscriptions/:companyId
 * Role: super_admin, company_admin
 */
export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const companyId = parseInt(req.params.companyId);
    const { cancel_immediately } = req.body;

    if (user.role !== 'super_admin' && user.company_id !== companyId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const result = await paymentProcessor.cancelSubscription(companyId, cancel_immediately || false);

    if (!result.success) {
      res.status(500).json({ success: false, message: result.error });
      return;
    }

    res.json({
      success: true,
      message: cancel_immediately
        ? 'Subscription cancelled immediately'
        : 'Subscription will be cancelled at period end'
    });

  } catch (error: any) {
    logger.error('Error cancelling subscription:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
