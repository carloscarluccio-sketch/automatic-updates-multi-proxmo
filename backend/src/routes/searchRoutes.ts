import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { globalSearch, advancedVMSearch } from '../controllers/globalSearchController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Global search
router.get('/global', globalSearch);

// Advanced VM search
router.get('/vms', advancedVMSearch);

export default router;
