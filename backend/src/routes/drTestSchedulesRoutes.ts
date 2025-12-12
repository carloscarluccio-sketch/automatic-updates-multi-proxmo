import { Router } from 'express';
import {
  getDRTestSchedules,
  getDRTestSchedule,
  createDRTestSchedule,
  updateDRTestSchedule,
  deleteDRTestSchedule,
  toggleDRTestSchedule,
  getDRClusterPairs,
} from '../controllers/drTestSchedulesController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// DR test schedule routes
router.get('/', getDRTestSchedules);
router.get('/cluster-pairs', getDRClusterPairs);
router.get('/:id', getDRTestSchedule);
router.post('/', createDRTestSchedule);
router.put('/:id', updateDRTestSchedule);
router.delete('/:id', deleteDRTestSchedule);
router.patch('/:id/toggle', toggleDRTestSchedule);

export default router;
