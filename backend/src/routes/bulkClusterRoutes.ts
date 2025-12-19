import express from 'express';
import {
  bulkTestConnection,
  bulkPushSSHKeys,
  getBulkOperationHistory,
} from '../controllers/bulkClusterController';
import { strictIPWhitelistMiddleware } from '../middlewares/ipWhitelist';

const router = express.Router();

// Bulk operations
router.post('/test-connection', strictIPWhitelistMiddleware, bulkTestConnection);
router.post('/push-ssh-keys', strictIPWhitelistMiddleware, bulkPushSSHKeys);
router.get('/history', getBulkOperationHistory);

export default router;
