import express from 'express';
import {
  get2FAStatus,
  setup2FATOTP,
  verify2FATOTP,
  disable2FA,
  validate2FAToken,
} from '../controllers/twoFactorController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

// All 2FA routes require authentication except validate (used during login)
router.get('/status', authenticate, get2FAStatus);
router.post('/setup', authenticate, setup2FATOTP);
router.post('/verify', authenticate, verify2FATOTP);
router.post('/disable', authenticate, disable2FA);

// Public endpoint for login validation
router.post('/validate', validate2FAToken);

export default router;
