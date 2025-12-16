/**
 * Billing Routes
 * Routes for billing and invoice management
 */

import express from 'express';
import {
  getBillingEstimate,
  getAllCompaniesBilling,
  getVMCosts,
  getBillingHistory,
  getPricingPlans,
  generateInvoiceManually,
  triggerDailySnapshots,
  triggerMonthlyInvoices
} from '../controllers/billingController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

// All billing routes require authentication
router.use(authenticate);

/**
 * GET /api/billing/estimate
 * Get current month cost estimate
 * Access: company_admin, super_admin
 * Query params: ?company_id=X (super_admin only)
 */
router.get('/estimate', getBillingEstimate);

/**
 * GET /api/billing/all-companies
 * Get billing overview for all companies
 * Access: super_admin only
 */
router.get('/all-companies', getAllCompaniesBilling);

/**
 * GET /api/billing/vm-costs
 * Get per-VM cost breakdown
 * Access: company_admin, super_admin
 * Query params: ?company_id=X (super_admin only)
 */
router.get('/vm-costs', getVMCosts);

/**
 * GET /api/billing/history
 * Get invoice history
 * Access: company_admin, super_admin
 * Query params: ?company_id=X (super_admin only)
 */
router.get('/history', getBillingHistory);

/**
 * GET /api/billing/pricing-plans
 * Get available pricing plans
 * Access: All authenticated users
 */
router.get('/pricing-plans', getPricingPlans);

/**
 * POST /api/billing/generate-invoice
 * Manually generate invoice for a company
 * Access: super_admin only
 * Body: { company_id: number, billing_month?: string }
 */
router.post('/generate-invoice', generateInvoiceManually);

/**
 * POST /api/billing/snapshots/daily
 * Trigger daily VM snapshots (for cron jobs)
 * Access: super_admin only
 */
router.post('/snapshots/daily', triggerDailySnapshots);

/**
 * POST /api/billing/invoices/generate-monthly
 * Trigger monthly invoice generation (for cron jobs)
 * Access: super_admin only
 */
router.post('/invoices/generate-monthly', triggerMonthlyInvoices);

export default router;
