import express from 'express';
import { getVMs, getVMStatus, controlVM } from '../controllers/vmsController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();
router.use(authenticate);
router.get('/', getVMs);
router.get('/:id/status', getVMStatus);
router.post('/:id/control', controlVM);

export default router;
