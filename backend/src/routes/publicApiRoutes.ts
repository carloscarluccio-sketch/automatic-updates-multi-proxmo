/**
 * Public API Routes (v1)
 * External API endpoints with API key authentication
 */

import { Router } from 'express';
import {
  listVMs,
  getVM,
  listInvoices,
  getBillingEstimate,
  listClusters,
  getApiUsage
} from '../controllers/publicApiController';
import {
  authenticateApiKey,
  apiRateLimiter,
  requireScope
} from '../middlewares/apiKeyAuth';

const router = Router();

/**
 * Health check (no authentication required)
 */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// Apply API key authentication to all routes below
router.use(authenticateApiKey);
router.use(apiRateLimiter);

/**
 * VMs Endpoints
 */
router.get('/vms', requireScope('vms:read'), listVMs);
router.get('/vms/:id', requireScope('vms:read'), getVM);

/**
 * Billing Endpoints
 */
router.get('/billing/invoices', requireScope('billing:read'), listInvoices);
router.get('/billing/estimate', requireScope('billing:read'), getBillingEstimate);

/**
 * Clusters Endpoints
 */
router.get('/clusters', requireScope('clusters:read'), listClusters);

/**
 * Usage Statistics
 */
router.get('/usage', getApiUsage);

export default router;
