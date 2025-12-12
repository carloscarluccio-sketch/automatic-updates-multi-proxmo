import { Router } from 'express';
import {
  getVMTemplates,
  getVMTemplate,
  createVMTemplate,
  updateVMTemplate,
  deleteVMTemplate,
  getAvailableClusters,
} from '../controllers/vmTemplatesController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getVMTemplates);
router.get('/available-clusters', getAvailableClusters);
router.get('/:id', getVMTemplate);
router.post('/', createVMTemplate);
router.put('/:id', updateVMTemplate);
router.delete('/:id', deleteVMTemplate);

export default router;
