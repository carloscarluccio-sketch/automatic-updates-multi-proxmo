// Companies routes
import { Router } from 'express';
import { getCompanies, createCompany } from '../controllers/companiesController';
import { authenticate, requireRole } from '../middlewares/auth';

const router = Router();

router.get('/', authenticate, getCompanies);
router.post('/', authenticate, requireRole('super_admin'), createCompany);

export default router;
