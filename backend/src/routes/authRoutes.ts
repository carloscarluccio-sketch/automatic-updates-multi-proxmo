// Authentication routes
import { Router } from 'express';
import { login, refresh, logout, me } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { authLimiter, passwordResetLimiter } from '../middlewares/rateLimiter';
import {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
} from '../controllers/passwordResetController';

import { validateEmailMiddleware, validateRequiredFields } from '../middlewares/inputValidation';
const router = Router();

router.post('/login', authLimiter, validateRequiredFields(['email', 'password']), validateEmailMiddleware('email'), login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

// Password reset routes
router.post('/request-password-reset', passwordResetLimiter, validateRequiredFields(['email']), validateEmailMiddleware('email'), requestPasswordReset);
router.post('/validate-reset-token', validateResetToken);
router.post('/reset-password', resetPassword);

export default router;
