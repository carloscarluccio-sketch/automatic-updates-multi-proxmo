import express from 'express';
import {
  triggerMonitoring,
  getMonitoringStats,
  getRecentAlerts,
  acknowledgeAlert,
  resolveAlert,
} from '../controllers/resourceMonitoringController';
import { authenticate, requireRole } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate);

// Manual monitoring trigger (super_admin only)
router.post('/trigger', requireRole('super_admin'), triggerMonitoring);

// Monitoring statistics (all authenticated users)
router.get('/stats', getMonitoringStats);

// Recent alerts (all authenticated users, company-filtered)
router.get('/recent-alerts', getRecentAlerts);

// Alert management
router.patch('/alerts/:id/acknowledge', acknowledgeAlert);
router.patch('/alerts/:id/resolve', resolveAlert);

export default router;
