import { Router } from 'express';
import {
  getAlertRules,
  getAlertRule,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  toggleEnabled,
  getAvailableTargets,
} from '../controllers/alertRulesController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getAlertRules);
router.get('/available-targets', getAvailableTargets);
router.get('/:id', getAlertRule);
router.post('/', createAlertRule);
router.put('/:id', updateAlertRule);
router.delete('/:id', deleteAlertRule);
router.patch('/:id/toggle-enabled', toggleEnabled);

export default router;
