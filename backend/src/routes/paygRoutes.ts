import { Router } from 'express';
import {
  getCurrentUsage,
  getVMUsageBreakdown,
  getDailyCostTrend,
  getResourceDistribution,
  getMonthlyHistory,
  getCurrentMetrics,
  getProjectCosts,
  getCostAlerts
} from '../controllers/paygController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Current usage and cost endpoints
router.get('/companies/:companyId/usage/current', getCurrentUsage);
router.get('/companies/:companyId/usage/vms', getVMUsageBreakdown);
router.get('/companies/:companyId/usage/trend', getDailyCostTrend);
router.get('/companies/:companyId/usage/distribution', getResourceDistribution);
router.get('/companies/:companyId/usage/projects', getProjectCosts);

// Historical data
router.get('/companies/:companyId/usage/history', getMonthlyHistory);

// Real-time metrics
router.get('/companies/:companyId/metrics/current', getCurrentMetrics);

// Alerts
router.get('/companies/:companyId/alerts', getCostAlerts);

export default router;
