import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  listRateLimits,
  getRateLimit,
  createRateLimit,
  updateRateLimit,
  deleteRateLimit,
  getRateLimitStats,
  getRateLimitViolations
} from '../controllers/rateLimitController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Statistics and violations
router.get('/stats', getRateLimitStats);
router.get('/violations', getRateLimitViolations);

// CRUD operations
router.get('/', listRateLimits);
router.get('/:id', getRateLimit);
router.post('/', createRateLimit);
router.patch('/:id', updateRateLimit);
router.delete('/:id', deleteRateLimit);

export default router;
