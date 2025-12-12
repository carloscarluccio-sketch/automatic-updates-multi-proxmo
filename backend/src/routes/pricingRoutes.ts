import { Router } from 'express';
import {
  getPricingTiers,
  getPricingTier,
  createPricingTier,
  updatePricingTier,
  deletePricingTier,
  getTierTypes
} from '../controllers/pricingController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get available tier types
router.get('/tier-types', getTierTypes);

// CRUD operations
router.get('/', getPricingTiers);
router.get('/:id', getPricingTier);
router.post('/', createPricingTier);
router.put('/:id', updatePricingTier);
router.delete('/:id', deletePricingTier);

export default router;
