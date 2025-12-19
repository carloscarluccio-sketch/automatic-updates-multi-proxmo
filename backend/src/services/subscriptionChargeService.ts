import Stripe from 'stripe';
import database from '../config/database';
import logger from '../utils/logger';

// Initialize Stripe (will be set when config is loaded)
let stripe: Stripe | null = null;

async function getStripeInstance(): Promise<Stripe | null> {
  if (stripe) return stripe;

  try {
    const config = await database.global_settings.findFirst({
      where: { setting_key: 'stripe_config' }
    });

    if (config?.setting_value_json) {
      const stripeConfig = JSON.parse(config.setting_value_json as string);
      if (stripeConfig.secret_key) {
        stripe = new Stripe(stripeConfig.secret_key, {
          apiVersion: '2025-12-15.clover'
        });
        return stripe;
      }
    }
  } catch (error) {
    logger.error('Error initializing Stripe:', error);
  }

  return null;
}

/**
 * Process subscription charges for companies with active subscriptions
 * This should be run daily via cron job
 */
export async function processSubscriptionCharges(): Promise<{
  processed: number;
  charged: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    processed: 0,
    charged: 0,
    failed: 0,
    errors: [] as string[]
  };

  try {
    logger.info('Starting subscription charge processing...');

    const stripeInstance = await getStripeInstance();
    if (!stripeInstance) {
      const error = 'Stripe not configured';
      logger.error(error);
      results.errors.push(error);
      return results;
    }

    // Get all active subscriptions due for charging today
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dueSubscriptions = await database.company_subscriptions.findMany({
      where: {
        status: 'active',
        current_period_end: {
          lte: today
        },
        stripe_subscription_id: {
          not: null
        }
      },
      include: {
        companies: {
          include: {
            company_billing: true
          }
        },
        subscription_plans: true
      }
    });

    logger.info(`Found ${dueSubscriptions.length} subscriptions due for charging`);
    results.processed = dueSubscriptions.length;

    for (const subscription of dueSubscriptions) {
      try {
        // Skip if company doesn't have Stripe customer ID
        if (!subscription.companies.company_billing?.stripe_customer_id) {
          const error = `Company ${subscription.company_id} has no Stripe customer ID`;
          logger.warn(error);
          results.errors.push(error);
          results.failed++;
          continue;
        }

        // Get Stripe subscription to ensure it's still active
        const stripeSubscription = await stripeInstance.subscriptions.retrieve(
          subscription.stripe_subscription_id!
        );

        if (stripeSubscription.status !== 'active') {
          logger.warn(`Stripe subscription ${subscription.stripe_subscription_id} is not active: ${stripeSubscription.status}`);

          // Update local subscription status
          // Map Stripe status to our enum
          let localStatus: 'active' | 'trial' | 'expired' | 'cancelled' | 'suspended' = 'cancelled';
          if (stripeSubscription.status === 'trialing') localStatus = 'trial';
          else if (stripeSubscription.status === 'past_due' || stripeSubscription.status === 'unpaid') localStatus = 'suspended';
          else if (stripeSubscription.status === 'canceled') localStatus = 'cancelled';

          await database.company_subscriptions.update({
            where: { id: subscription.id },
            data: {
              status: localStatus
            }
          });

          results.failed++;
          continue;
        }

        // Create invoice for subscription
        const invoice = await stripeInstance.invoices.create({
          customer: subscription.companies.company_billing.stripe_customer_id,
          subscription: subscription.stripe_subscription_id!,
          auto_advance: true, // Automatically finalize and pay
          description: `Subscription charge for ${subscription.subscription_plans?.name || 'plan'}`
        });

        // Finalize and pay invoice
        await stripeInstance.invoices.finalizeInvoice(invoice.id);
        const paidInvoice = await stripeInstance.invoices.pay(invoice.id);

        if (paidInvoice.status === 'paid') {
          // Update subscription next billing date
          const nextBillingDate = new Date(subscription.current_period_end);

          // Add billing cycle based on plan interval
          const interval = subscription.subscription_plans?.billing_period || 'monthly';
          if (interval === 'monthly') {
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
          } else if (interval === 'yearly') {
            nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
          } else if (interval === 'quarterly') {
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
          }

          // Update subscription period dates
          await database.company_subscriptions.update({
            where: { id: subscription.id },
            data: {
              current_period_start: new Date(),
              current_period_end: nextBillingDate
            }
          });

          // Also update company next_billing_date
          await database.companies.update({
            where: { id: subscription.company_id },
            data: {
              next_billing_date: nextBillingDate
            }
          });

          logger.info(`Successfully charged company ${subscription.company_id} for subscription ${subscription.id}`);
          results.charged++;
        } else {
          const error = `Invoice ${invoice.id} not paid: ${paidInvoice.status}`;
          logger.error(error);
          results.errors.push(error);
          results.failed++;
        }

      } catch (error: any) {
        const errorMsg = `Failed to charge company ${subscription.company_id}: ${error.message}`;
        logger.error(errorMsg, error);
        results.errors.push(errorMsg);
        results.failed++;
      }
    }

    logger.info(`Subscription charge processing complete: ${results.charged} charged, ${results.failed} failed`);

  } catch (error: any) {
    logger.error('Error in subscription charge processing:', error);
    results.errors.push(error.message || 'Unknown error');
  }

  return results;
}

/**
 * Check for subscriptions that are past due and mark them
 */
export async function checkPastDueSubscriptions(): Promise<number> {
  try {
    const now = new Date();
    const gracePeriodDays = 3; // Give 3 days grace period
    const pastDueDate = new Date(now);
    pastDueDate.setDate(pastDueDate.getDate() - gracePeriodDays);

    const result = await database.company_subscriptions.updateMany({
      where: {
        status: 'active',
        current_period_end: {
          lt: pastDueDate
        }
      },
      data: {
        status: 'suspended'
      }
    });

    if (result.count > 0) {
      logger.warn(`Marked ${result.count} subscriptions as past_due`);
    }

    return result.count;
  } catch (error) {
    logger.error('Error checking past due subscriptions:', error);
    return 0;
  }
}

/**
 * Cancel subscriptions that have been past due for too long
 */
export async function cancelPastDueSubscriptions(): Promise<number> {
  try {
    const stripeInstance = await getStripeInstance();
    if (!stripeInstance) return 0;

    const cancelThresholdDays = 30; // Cancel after 30 days past due
    const cancelDate = new Date();
    cancelDate.setDate(cancelDate.getDate() - cancelThresholdDays);

    const suspendedSubscriptions = await database.company_subscriptions.findMany({
      where: {
        status: 'suspended',
        current_period_end: {
          lt: cancelDate
        },
        stripe_subscription_id: {
          not: null
        }
      }
    });

    let cancelledCount = 0;

    for (const subscription of suspendedSubscriptions) {
      try {
        // Cancel in Stripe
        await stripeInstance.subscriptions.cancel(subscription.stripe_subscription_id!);

        // Update local status
        await database.company_subscriptions.update({
          where: { id: subscription.id },
          data: {
            status: 'cancelled',
            cancelled_at: new Date()
          }
        });

        logger.info(`Cancelled past due subscription ${subscription.id} for company ${subscription.company_id}`);
        cancelledCount++;

      } catch (error) {
        logger.error(`Failed to cancel subscription ${subscription.id}:`, error);
      }
    }

    if (cancelledCount > 0) {
      logger.warn(`Cancelled ${cancelledCount} past due subscriptions`);
    }

    return cancelledCount;
  } catch (error) {
    logger.error('Error cancelling past due subscriptions:', error);
    return 0;
  }
}

export default {
  processSubscriptionCharges,
  checkPastDueSubscriptions,
  cancelPastDueSubscriptions
};
