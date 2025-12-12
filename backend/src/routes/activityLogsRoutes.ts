import express from 'express';
import {
  getActivityLogs,
  getActivityStats,
  getAuditLogs,
  createActivityLog,
} from '../controllers/activityLogsController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Activity Logs
router.get('/activity', getActivityLogs);
router.get('/activity/stats', getActivityStats);
router.post('/activity', createActivityLog);

// Audit Logs
router.get('/audit', getAuditLogs);

export default router;
