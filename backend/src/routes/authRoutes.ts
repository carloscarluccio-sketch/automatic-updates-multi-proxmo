// Authentication routes
import { Router } from 'express';
import { login, refresh, logout } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);

export default router;
