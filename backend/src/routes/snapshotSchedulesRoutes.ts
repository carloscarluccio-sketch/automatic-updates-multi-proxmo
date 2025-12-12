import { Router } from 'express';
import {
  getSnapshotSchedules,
  getSnapshotSchedule,
  createSnapshotSchedule,
  updateSnapshotSchedule,
  deleteSnapshotSchedule,
  toggleSnapshotSchedule,
} from '../controllers/snapshotSchedulesController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Snapshot schedule routes
router.get('/', getSnapshotSchedules);
router.get('/:id', getSnapshotSchedule);
router.post('/', createSnapshotSchedule);
router.put('/:id', updateSnapshotSchedule);
router.delete('/:id', deleteSnapshotSchedule);
router.patch('/:id/toggle', toggleSnapshotSchedule);

export default router;
