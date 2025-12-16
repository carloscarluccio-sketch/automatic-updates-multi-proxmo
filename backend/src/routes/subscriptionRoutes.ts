import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  getCompanySubscription,
  subscribeCompany,
  cancelSubscription,
  getSubscriptionStats
} from '../controllers/subscriptionController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Statistics
router.get('/stats', getSubscriptionStats);

// Subscription plans (CRUD)
router.get('/plans', listPlans);
router.get('/plans/:id', getPlan);
router.post('/plans', createPlan);
router.patch('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);

// Company subscriptions
router.get('/company/:companyId', getCompanySubscription);
router.post('/subscribe', subscribeCompany);
router.patch('/:id/cancel', cancelSubscription);

export default router;
