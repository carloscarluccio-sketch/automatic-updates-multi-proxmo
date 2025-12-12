/**
 * IP Tracking & Monitoring Routes
 * Phase 1.4
 */

import { Router } from 'express';
import {
  getIPUtilization,
  getIPTimeline,
  getIPConflicts,
  getIPAnalytics,
  exportIPReport,
} from '../controllers/ipTrackingController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// IP Tracking endpoints
router.get('/utilization', getIPUtilization);
router.get('/timeline', getIPTimeline);
router.get('/conflicts', getIPConflicts);
router.get('/analytics', getIPAnalytics);
router.get('/export', exportIPReport);

export default router;
