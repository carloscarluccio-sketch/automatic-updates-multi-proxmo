import express from 'express';
import {
  bulkTestConnection,
  bulkPushSSHKeys,
  getBulkOperationHistory,
} from '../controllers/bulkClusterController';

const router = express.Router();

// Bulk operations
router.post('/test-connection', bulkTestConnection);
router.post('/push-ssh-keys', bulkPushSSHKeys);
router.get('/history', getBulkOperationHistory);

export default router;
