/**
 * Pricing Plan Routes
 * Routes for pricing plan management
 */

import express from 'express';
import {
  getPricingPlans,
  getPricingPlan,
  createPricingPlan,
  updatePricingPlan,
  deletePricingPlan,
  assignPricingPlan,
  getCompaniesUsingPlan
} from '../controllers/pricingPlanController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

// All pricing plan routes require authentication
router.use(authenticate);

/**
 * GET /api/pricing-plans
 * Get all pricing plans
 * Access: All authenticated users (filtered by role)
 */
router.get('/', getPricingPlans);

/**
 * GET /api/pricing-plans/:id
 * Get single pricing plan
 * Access: All authenticated users
 */
router.get('/:id', getPricingPlan);

/**
 * POST /api/pricing-plans
 * Create new pricing plan
 * Access: super_admin only
 */
router.post('/', createPricingPlan);

/**
 * PUT /api/pricing-plans/:id
 * Update pricing plan
 * Access: super_admin only
 */
router.put('/:id', updatePricingPlan);

/**
 * DELETE /api/pricing-plans/:id
 * Delete pricing plan
 * Access: super_admin only
 */
router.delete('/:id', deletePricingPlan);

/**
 * POST /api/pricing-plans/:id/assign
 * Assign pricing plan to a company
 * Access: super_admin only
 */
router.post('/:id/assign', assignPricingPlan);

/**
 * GET /api/pricing-plans/:id/companies
 * Get companies using this pricing plan
 * Access: super_admin only
 */
router.get('/:id/companies', getCompaniesUsingPlan);

export default router;
