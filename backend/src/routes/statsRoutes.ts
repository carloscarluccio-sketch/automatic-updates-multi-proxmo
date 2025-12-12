import express from 'express';
import { getStats } from '../controllers/statsController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();
router.use(authenticate);
router.get('/', getStats);

export default router;
