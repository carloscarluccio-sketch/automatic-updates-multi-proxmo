import { Router } from 'express';
import {
  batchAssignIPs,
  batchUnassignIPs,
  batchReassignIPs,
  previewBatchAssignment,
  getBatchAssignmentHistory,
} from '../controllers/batchIPController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Batch assignment operations
router.post('/assign', batchAssignIPs);
router.post('/unassign', batchUnassignIPs);
router.post('/reassign', batchReassignIPs);
router.post('/preview', previewBatchAssignment);

// History and analytics
router.get('/history', getBatchAssignmentHistory);

export default router;
