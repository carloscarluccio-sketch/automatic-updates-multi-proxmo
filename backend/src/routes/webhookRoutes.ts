import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  listWebhooks,
  getWebhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookDeliveries,
  getWebhookStats
} from '../controllers/webhookController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Statistics (should be before /:id routes)
router.get('/stats', getWebhookStats);

// CRUD operations
router.get('/', listWebhooks);
router.get('/:id', getWebhook);
router.post('/', createWebhook);
router.patch('/:id', updateWebhook);
router.delete('/:id', deleteWebhook);

// Webhook operations
router.post('/:id/test', testWebhook);
router.get('/:id/deliveries', getWebhookDeliveries);

export default router;
