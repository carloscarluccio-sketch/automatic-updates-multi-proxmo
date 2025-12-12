import { Router } from 'express';
import {
  getDRClusterPairs,
  getDRClusterPair,
  createDRClusterPair,
  updateDRClusterPair,
  deleteDRClusterPair,
  toggleReplication,
  getAvailableClusters,
} from '../controllers/drClusterPairsController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// DR cluster pair routes
router.get('/', getDRClusterPairs);
router.get('/available-clusters', getAvailableClusters);
router.get('/:id', getDRClusterPair);
router.post('/', createDRClusterPair);
router.put('/:id', updateDRClusterPair);
router.delete('/:id', deleteDRClusterPair);
router.patch('/:id/toggle-replication', toggleReplication);

export default router;
