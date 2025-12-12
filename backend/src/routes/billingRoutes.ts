import express from 'express';
import {
  getBillingOverview,
  getUsageHistory,
  getAllCompaniesBilling
} from '../controllers/billingController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate);
router.get('/overview', getBillingOverview);
router.get('/usage-history', getUsageHistory);
router.get('/all-companies', getAllCompaniesBilling);

export default router;
