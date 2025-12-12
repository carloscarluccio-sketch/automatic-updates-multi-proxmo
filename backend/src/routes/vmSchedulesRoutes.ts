import express from 'express';
import {
  getVMSchedules,
  getVMSchedule,
  createVMSchedule,
  updateVMSchedule,
  deleteVMSchedule,
  toggleVMSchedule,
  getVMScheduleLogs,
} from '../controllers/vmSchedulesController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate);

// VM Schedule CRUD
router.get('/', getVMSchedules);
router.get('/:id', getVMSchedule);
router.post('/', createVMSchedule);
router.put('/:id', updateVMSchedule);
router.delete('/:id', deleteVMSchedule);

// Toggle schedule
router.patch('/:id/toggle', toggleVMSchedule);

// Schedule logs
router.get('/:id/logs', getVMScheduleLogs);

export default router;
