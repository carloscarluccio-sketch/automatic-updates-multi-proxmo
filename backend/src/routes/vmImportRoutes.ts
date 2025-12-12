import express from 'express';
import {
  discoverVMs,
  importVMs,
  reassignVMCompany,
  getVMsForReassignment
} from '../controllers/vmImportController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate);
router.post('/discover', discoverVMs);
router.post('/import', importVMs);
router.put('/:id/reassign', reassignVMCompany);
router.get('/reassignment-list', getVMsForReassignment);

export default router;
