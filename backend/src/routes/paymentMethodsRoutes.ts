import express from 'express';
import * as paymentMethodsController from '../controllers/paymentMethodsController';
import { authenticate } from '../middlewares/auth';

import * as stripeWebhookController from '../controllers/stripeWebhookController';
const router = express.Router();

// Stripe webhook (NO authentication, needs raw body)
router.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookController.handleStripeWebhook
);

router.use(authenticate);

// Stripe Configuration (super_admin only)
router.get(
  '/stripe/config',
  paymentMethodsController.getStripeConfig
);

router.put(
  '/stripe/config',
  paymentMethodsController.updateStripeConfig
);

// PayPal Configuration (super_admin only)
router.get(
  '/paypal/config',
  paymentMethodsController.getPayPalConfig
);

router.put(
  '/paypal/config',
  paymentMethodsController.updatePayPalConfig
);

// Payment Methods (company_admin and super_admin)
router.get(
  '/methods',
  paymentMethodsController.getPaymentMethods
);

router.post(
  '/methods/setup-intent',
  paymentMethodsController.createSetupIntent
);

router.post(
  '/methods',
  paymentMethodsController.addPaymentMethod
);

router.delete(
  '/methods/:id',
  paymentMethodsController.deletePaymentMethod
);

router.put(
  '/methods/:id/default',
  paymentMethodsController.setDefaultPaymentMethod
);

// Payments
router.post(
  '/create-intent',
  paymentMethodsController.createPaymentIntent
);

// Subscriptions
router.post(
  '/subscriptions',
  paymentMethodsController.createSubscription
);

router.delete(
  '/subscriptions/:companyId',
  paymentMethodsController.cancelSubscription
);

export default router;
