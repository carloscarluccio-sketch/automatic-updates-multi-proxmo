import express from 'express';
import {
  checkForUpdates,
  getChangelog,
  executeUpdate,
  rollbackUpdate,
  getUpdateHistory,
  getSystemInfo
} from '../controllers/updateController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Check for available updates
router.get('/check', checkForUpdates);

// Get changelog for specific version
router.get('/changelog/:version', getChangelog);

// Execute system update
router.post('/execute', executeUpdate);

// Rollback to previous version
router.post('/rollback', rollbackUpdate);

// Get update history
router.get('/history', getUpdateHistory);

// Get current system information
router.get('/info', getSystemInfo);

export default router;
