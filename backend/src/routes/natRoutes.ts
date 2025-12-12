import express from 'express';
import {
  getNATRules,
  getNATRule,
  createNATRule,
  updateNATRule,
  deleteNATRule,
  toggleNATRule,
  deployNATRule,
  undeployNATRule,
  getNATDeploymentLogs,
  testNATConnection,
  verifyNATDeployment,
  getNATPerformanceStatsController,
} from '../controllers/natController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

// All NAT routes require authentication
router.use(authenticate);

// NAT Rules CRUD
router.get('/', getNATRules);
router.get('/:id', getNATRule);
router.post('/', createNATRule);
router.put('/:id', updateNATRule);
router.delete('/:id', deleteNATRule);
router.post('/:id/toggle', toggleNATRule);

// Deployment endpoints
router.post('/:id/deploy', deployNATRule);
router.post('/:id/undeploy', undeployNATRule);
router.get('/:id/deployment-logs', getNATDeploymentLogs);

// Testing and verification endpoints
router.post('/:id/test-connection', testNATConnection);
router.post('/:id/verify', verifyNATDeployment);

// Performance stats
router.get('/performance-stats', getNATPerformanceStatsController);

export default router;
