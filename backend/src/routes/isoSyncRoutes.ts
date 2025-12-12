import express from 'express';
import {
  startISOSync,
  getISOSyncStatus,
  getISOSyncJobs,
  cancelISOSync
} from '../controllers/isoSyncController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate);

// ISO sync routes
router.post('/sync', startISOSync);
router.get('/sync/jobs', getISOSyncJobs);
router.get('/sync/:jobId', getISOSyncStatus);
router.delete('/sync/:jobId', cancelISOSync);

export default router;
