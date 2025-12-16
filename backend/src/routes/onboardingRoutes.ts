/**
 * Onboarding Routes
 * Public API endpoints for customer self-service registration
 */

import express from 'express';
import { authenticateApiToken, requireScope } from '../middlewares/apiTokenAuth';
import { authenticate } from '../middlewares/auth';
import {
  registerCustomer,
  getRegistrationStatus,
  verifyEmail,
  getSubscriptionPlans,
  selectPlan,
  resendVerificationEmail,
  reviewRegistration,
  completeAccountSetup,
  listPendingRegistrations
} from '../controllers/onboardingController';

const router = express.Router();

// ============================================
// PUBLIC ROUTES (API Token Authentication)
// ============================================

/**
 * @route POST /api/public/onboarding/register
 * @desc Register new customer
 * @access Public (API Token: onboarding:write)
 */
router.post(
  '/register',
  authenticateApiToken,
  requireScope('onboarding:write', 'onboarding:*', '*'),
  registerCustomer
);

/**
 * @route GET /api/public/onboarding/status/:tracking_code
 * @desc Get registration status and progress
 * @access Public (API Token: onboarding:read)
 */
router.get(
  '/status/:tracking_code',
  authenticateApiToken,
  requireScope('onboarding:read', 'onboarding:*', '*'),
  getRegistrationStatus
);

/**
 * @route POST /api/public/onboarding/verify-email
 * @desc Verify email address
 * @access Public (API Token: onboarding:write)
 */
router.post(
  '/verify-email',
  authenticateApiToken,
  requireScope('onboarding:write', 'onboarding:*', '*'),
  verifyEmail
);

/**
 * @route POST /api/public/onboarding/:tracking_code/resend-verification
 * @desc Resend email verification
 * @access Public (API Token: onboarding:write)
 */
router.post(
  '/:tracking_code/resend-verification',
  authenticateApiToken,
  requireScope('onboarding:write', 'onboarding:*', '*'),
  resendVerificationEmail
);

/**
 * @route GET /api/public/onboarding/plans
 * @desc Get available subscription plans
 * @access Public (API Token: onboarding:read)
 */
router.get(
  '/plans',
  authenticateApiToken,
  requireScope('onboarding:read', 'onboarding:*', '*'),
  getSubscriptionPlans
);

/**
 * @route POST /api/public/onboarding/:tracking_code/select-plan
 * @desc Select subscription plan
 * @access Public (API Token: onboarding:write)
 */
router.post(
  '/:tracking_code/select-plan',
  authenticateApiToken,
  requireScope('onboarding:write', 'onboarding:*', '*'),
  selectPlan
);

// ============================================
// ADMIN ROUTES (JWT Authentication)
// ============================================

/**
 * @route GET /api/admin/onboarding/pending
 * @desc List pending registrations
 * @access Private (super_admin, company_admin)
 */
router.get(
  '/admin/pending',
  authenticate,
  listPendingRegistrations
);

/**
 * @route POST /api/admin/onboarding/:id/review
 * @desc Approve or reject registration
 * @access Private (super_admin only)
 */
router.post(
  '/admin/:id/review',
  authenticate,
  reviewRegistration
);

/**
 * @route POST /api/admin/onboarding/:id/complete-setup
 * @desc Complete account setup (create company and user)
 * @access Private (super_admin only)
 */
router.post(
  '/admin/:id/complete-setup',
  authenticate,
  completeAccountSetup
);

export default router;
