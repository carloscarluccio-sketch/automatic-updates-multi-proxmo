import Stripe from 'stripe';
import database from '../config/database';
import logger from '../utils/logger';

interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret?: string;
}

interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  mode: 'sandbox' | 'live';
}

interface PaymentMethodData {
  company_id: number;
  type: 'card' | 'bank_account' | 'paypal';
  provider: 'stripe' | 'paypal';
  provider_payment_method_id: string;
  last4?: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
}

interface CreatePaymentIntentOptions {
  amount: number;
  currency: string;
  company_id: number;
  payment_method_id?: string;
  description?: string;
  metadata?: Record<string, any>;
}

interface CreateSubscriptionOptions {
  company_id: number;
  plan_id: number;
  payment_method_id: string;
  trial_days?: number;
}

class PaymentProcessingService {
  private stripe: Stripe | null = null;

  async getStripeConfig(): Promise<StripeConfig | null> {
    try {
      const config = await database.global_settings.findFirst({
        where: { setting_key: 'stripe_config' }
      });

      if (config && config.setting_value_json) {
        const stripeSettings = JSON.parse(config.setting_value_json as string);
        return {
          secretKey: stripeSettings.secret_key,
          publishableKey: stripeSettings.publishable_key,
          webhookSecret: stripeSettings.webhook_secret
        };
      }

      // Fallback to environment variables
      if (process.env.STRIPE_SECRET_KEY) {
        return {
          secretKey: process.env.STRIPE_SECRET_KEY,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
        };
      }

      logger.warn('No Stripe configuration found');
      return null;
    } catch (error) {
      logger.error('Error getting Stripe config:', error);
      return null;
    }
  }

  async getPayPalConfig(): Promise<PayPalConfig | null> {
    try {
      const config = await database.global_settings.findFirst({
        where: { setting_key: 'paypal_config' }
      });

      if (config && config.setting_value_json) {
        const paypalSettings = JSON.parse(config.setting_value_json as string);
        return {
          clientId: paypalSettings.client_id,
          clientSecret: paypalSettings.client_secret,
          mode: paypalSettings.mode || 'sandbox'
        };
      }

      // Fallback to environment variables
      if (process.env.PAYPAL_CLIENT_ID) {
        return {
          clientId: process.env.PAYPAL_CLIENT_ID,
          clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
          mode: (process.env.PAYPAL_MODE as 'sandbox' | 'live') || 'sandbox'
        };
      }

      logger.warn('No PayPal configuration found');
      return null;
    } catch (error) {
      logger.error('Error getting PayPal config:', error);
      return null;
    }
  }

  async initializeStripe(): Promise<boolean> {
    try {
      const config = await this.getStripeConfig();
      if (!config || !config.secretKey) {
        logger.error('Cannot initialize Stripe: No secret key');
        return false;
      }

      this.stripe = new Stripe(config.secretKey, {
        apiVersion: '2025-12-15.clover'
      });

      logger.info('Stripe initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Stripe:', error);
      this.stripe = null;
      return false;
    }
  }

  async createStripeCustomer(companyId: number): Promise<{ success: boolean; customerId?: string; error?: string }> {
    try {
      if (!this.stripe) {
        const initialized = await this.initializeStripe();
        if (!initialized) {
          throw new Error('Stripe not initialized');
        }
      }

      const company = await database.companies.findUnique({
        where: { id: companyId },
        include: { company_billing: true }
      });

      if (!company) {
        return { success: false, error: 'Company not found' };
      }

      const customer = await this.stripe!.customers.create({
        name: company.name,
        email: company.primary_email || undefined,
        metadata: {
          company_id: companyId.toString()
        }
      });

      // Update company_billing with Stripe customer ID
      await database.company_billing.upsert({
        where: { company_id: companyId },
        update: {
          stripe_customer_id: customer.id
        },
        create: {
          company_id: companyId,
          billing_email: company.primary_email || '',
          stripe_customer_id: customer.id
        }
      });

      logger.info(`Stripe customer created for company ${companyId}: ${customer.id}`);
      return { success: true, customerId: customer.id };

    } catch (error: any) {
      logger.error('Error creating Stripe customer:', error);
      return { success: false, error: error.message || 'Failed to create customer' };
    }
  }

  async addPaymentMethod(data: PaymentMethodData): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
      // Ensure company has Stripe customer ID
      const companyBilling = await database.company_billing.findUnique({
        where: { company_id: data.company_id }
      });

      if (!companyBilling?.stripe_customer_id) {
        const result = await this.createStripeCustomer(data.company_id);
        if (!result.success) {
          return { success: false, error: 'Failed to create Stripe customer' };
        }
      }

      // If setting as default, unset other defaults
      if (data.is_default) {
        await database.company_payment_methods.updateMany({
          where: {
            company_id: data.company_id,
            is_primary: true
          },
          data: {
            is_primary: false
          }
        });
      }

      // Map payment type: 'card' -> 'credit_card'
      const paymentType = data.type === 'card' ? 'credit_card' : data.type === 'bank_account' ? 'bank_transfer' : data.provider;

      const paymentMethod = await database.company_payment_methods.create({
        data: {
          company_id: data.company_id,
          payment_type: paymentType as any,
          stripe_payment_method_id: data.provider_payment_method_id,
          stripe_card_last4: data.last4,
          stripe_card_brand: data.brand,
          stripe_card_exp_month: data.exp_month,
          stripe_card_exp_year: data.exp_year,
          is_primary: data.is_default,
          is_active: true
        }
      });

      logger.info(`Payment method added for company ${data.company_id}: ${paymentMethod.id}`);
      return { success: true, id: paymentMethod.id };

    } catch (error: any) {
      logger.error('Error adding payment method:', error);
      return { success: false, error: error.message || 'Failed to add payment method' };
    }
  }

  async createPaymentIntent(options: CreatePaymentIntentOptions): Promise<{ success: boolean; clientSecret?: string; error?: string }> {
    try {
      if (!this.stripe) {
        const initialized = await this.initializeStripe();
        if (!initialized) {
          throw new Error('Stripe not initialized');
        }
      }

      const companyBilling = await database.company_billing.findUnique({
        where: { company_id: options.company_id }
      });

      if (!companyBilling?.stripe_customer_id) {
        return { success: false, error: 'Company has no Stripe customer ID' };
      }

      const paymentIntent = await this.stripe!.paymentIntents.create({
        amount: Math.round(options.amount * 100), // Convert to cents
        currency: options.currency.toLowerCase(),
        customer: companyBilling.stripe_customer_id,
        payment_method: options.payment_method_id,
        description: options.description,
        metadata: options.metadata || {}
      });

      logger.info(`Payment intent created for company ${options.company_id}: ${paymentIntent.id}`);
      return { success: true, clientSecret: paymentIntent.client_secret || undefined };

    } catch (error: any) {
      logger.error('Error creating payment intent:', error);
      return { success: false, error: error.message || 'Failed to create payment intent' };
    }
  }

  async createSubscription(options: CreateSubscriptionOptions): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    try {
      if (!this.stripe) {
        const initialized = await this.initializeStripe();
        if (!initialized) {
          throw new Error('Stripe not initialized');
        }
      }

      const companyBilling = await database.company_billing.findUnique({
        where: { company_id: options.company_id }
      });

      if (!companyBilling?.stripe_customer_id) {
        return { success: false, error: 'Company has no Stripe customer ID' };
      }

      const plan = await database.subscription_plans.findUnique({
        where: { id: options.plan_id }
      });

      if (!plan) {
        return { success: false, error: 'Subscription plan not found' };
      }

      // Create price in Stripe if not exists
      const price = await this.stripe!.prices.create({
        unit_amount: Math.round(Number(plan.price) * 100),
        currency: plan.currency?.toLowerCase() || 'usd',
        recurring: {
          interval: plan.billing_period as 'month' | 'year'
        },
        product_data: {
          name: plan.name
        }
      });

      const subscription = await this.stripe!.subscriptions.create({
        customer: companyBilling.stripe_customer_id,
        items: [{ price: price.id }],
        default_payment_method: options.payment_method_id,
        trial_period_days: options.trial_days || plan.trial_days || undefined,
        metadata: {
          company_id: options.company_id.toString(),
          plan_id: options.plan_id.toString()
        }
      });

      // Update company subscription
      const subscriptionData: any = subscription;
      await database.company_subscriptions.create({
        data: {
          company_id: options.company_id,
          plan_id: options.plan_id,
          status: 'active',
          stripe_subscription_id: subscription.id,
          stripe_customer_id: companyBilling.stripe_customer_id,
          current_period_start: new Date(subscriptionData.current_period_start * 1000),
          current_period_end: new Date(subscriptionData.current_period_end * 1000)
        }
      });

      logger.info(`Subscription created for company ${options.company_id}: ${subscription.id}`);
      return { success: true, subscriptionId: subscription.id };

    } catch (error: any) {
      logger.error('Error creating subscription:', error);
      return { success: false, error: error.message || 'Failed to create subscription' };
    }
  }

  async cancelSubscription(companyId: number, cancelImmediately: boolean = false): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.stripe) {
        const initialized = await this.initializeStripe();
        if (!initialized) {
          throw new Error('Stripe not initialized');
        }
      }

      const subscription = await database.company_subscriptions.findFirst({
        where: {
          company_id: companyId,
          status: { in: ['active', 'trial'] }
        },
        orderBy: { created_at: 'desc' }
      });

      if (!subscription || !subscription.stripe_subscription_id) {
        return { success: false, error: 'No active subscription found' };
      }

      if (cancelImmediately) {
        await this.stripe!.subscriptions.cancel(subscription.stripe_subscription_id);

        await database.company_subscriptions.update({
          where: { id: subscription.id },
          data: {
            status: 'cancelled',
            cancelled_at: new Date()
          }
        });
      } else {
        await this.stripe!.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: true
        });

        await database.company_subscriptions.update({
          where: { id: subscription.id },
          data: {
            cancel_at_period_end: true
          }
        });
      }

      logger.info(`Subscription cancelled for company ${companyId}: ${subscription.stripe_subscription_id}`);
      return { success: true };

    } catch (error: any) {
      logger.error('Error cancelling subscription:', error);
      return { success: false, error: error.message || 'Failed to cancel subscription' };
    }
  }

  async getPaymentMethods(companyId: number): Promise<any[]> {
    try {
      const methods = await database.company_payment_methods.findMany({
        where: {
          company_id: companyId,
          is_active: true
        },
        orderBy: [
          { is_primary: 'desc' },
          { created_at: 'desc' }
        ]
      });

      return methods;
    } catch (error) {
      logger.error('Error getting payment methods:', error);
      return [];
    }
  }

  async deletePaymentMethod(methodId: number, companyId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const method = await database.company_payment_methods.findFirst({
        where: {
          id: methodId,
          company_id: companyId
        }
      });

      if (!method) {
        return { success: false, error: 'Payment method not found' };
      }

      // If Stripe payment method, detach from customer
      if (method.stripe_payment_method_id && this.stripe) {
        await this.initializeStripe();
        await this.stripe!.paymentMethods.detach(method.stripe_payment_method_id);
      }

      await database.company_payment_methods.update({
        where: { id: methodId },
        data: { is_active: false }
      });

      logger.info(`Payment method deleted: ${methodId}`);
      return { success: true };

    } catch (error: any) {
      logger.error('Error deleting payment method:', error);
      return { success: false, error: error.message || 'Failed to delete payment method' };
    }
  }

  async setDefaultPaymentMethod(methodId: number, companyId: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Unset other defaults
      await database.company_payment_methods.updateMany({
        where: {
          company_id: companyId,
          is_primary: true
        },
        data: {
          is_primary: false
        }
      });

      // Set new default
      await database.company_payment_methods.update({
        where: { id: methodId },
        data: { is_primary: true }
      });

      logger.info(`Default payment method set: ${methodId}`);
      return { success: true };

    } catch (error: any) {
      logger.error('Error setting default payment method:', error);
      return { success: false, error: error.message || 'Failed to set default payment method' };
    }
  }
}

const paymentProcessor = new PaymentProcessingService();
export default paymentProcessor;
export { paymentProcessor, PaymentProcessingService };
