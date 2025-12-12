import { Router } from 'express';
import {
  getBackupSchedules,
  getBackupSchedule,
  createBackupSchedule,
  updateBackupSchedule,
  deleteBackupSchedule,
  toggleBackupSchedule,
} from '../controllers/backupSchedulesController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all backup schedules
router.get('/', getBackupSchedules);

// Get single backup schedule
router.get('/:id', getBackupSchedule);

// Create backup schedule
router.post('/', createBackupSchedule);

// Update backup schedule
router.put('/:id', updateBackupSchedule);

// Delete backup schedule
router.delete('/:id', deleteBackupSchedule);

// Toggle backup schedule enable/disable
router.patch('/:id/toggle', toggleBackupSchedule);

export default router;
