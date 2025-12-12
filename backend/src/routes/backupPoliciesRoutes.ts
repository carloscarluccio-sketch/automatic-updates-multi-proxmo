import { Router } from 'express';
import {
  getBackupPolicies,
  getBackupPolicy,
  createBackupPolicy,
  updateBackupPolicy,
  deleteBackupPolicy,
  toggleEnabled,
  getAvailableClusters,
} from '../controllers/backupPoliciesController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getBackupPolicies);
router.get('/available-clusters', getAvailableClusters);
router.get('/:id', getBackupPolicy);
router.post('/', createBackupPolicy);
router.put('/:id', updateBackupPolicy);
router.delete('/:id', deleteBackupPolicy);
router.patch('/:id/toggle-enabled', toggleEnabled);

export default router;
