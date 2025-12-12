import { Router } from 'express';
import {
  getVMSummary,
  getTopConsumers,
  getClusterAnalytics,
  getVMAnalytics,
} from '../controllers/analyticsController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All analytics routes require authentication
router.use(authenticate);

// VM summary analytics
router.get('/vm/summary', getVMSummary);

// Top resource consumers
router.get('/top-consumers', getTopConsumers);

// Cluster-specific analytics
router.get('/cluster/:clusterId', getClusterAnalytics);

// VM-specific analytics
router.get('/vm/:vmId', getVMAnalytics);

export default router;
