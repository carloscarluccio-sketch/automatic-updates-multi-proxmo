import express from 'express';
import {
  getTokens,
  createToken,
  updateToken,
  revokeToken,
  deleteToken,
} from '../controllers/apiTokensController';
import { authenticate } from '../middlewares/auth';
import { tokenGenerationLimiter } from '../middlewares/rateLimiter';

const router = express.Router();

router.use(authenticate);

router.get('/', getTokens);
router.post('/', tokenGenerationLimiter, createToken);
router.put('/:id', updateToken);
router.post('/:id/revoke', revokeToken);
router.delete('/:id', deleteToken);

export default router;
