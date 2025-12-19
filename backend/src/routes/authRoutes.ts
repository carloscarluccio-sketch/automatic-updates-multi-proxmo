// Authentication routes
import { Router } from 'express';
import { login, refresh, logout, me } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';
import {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
} from '../controllers/passwordResetController';

const router = Router();

router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

// Password reset routes
router.post('/request-password-reset', authLimiter, requestPasswordReset);
router.post('/validate-reset-token', validateResetToken);
router.post('/reset-password', resetPassword);

export default router;
