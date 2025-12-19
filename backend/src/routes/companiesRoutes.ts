import express from 'express';
import { getCompanies, getCompany, createCompany, updateCompany, deleteCompany } from '../controllers/companiesController';
import { authenticate } from '../middlewares/auth';
import { companyManagementLimiter } from '../middlewares/rateLimiter';

const router = express.Router();

router.use(authenticate);
router.get('/', getCompanies);
router.get('/:id', getCompany);
import { validateRequiredFields, validateEmailMiddleware } from '../middlewares/inputValidation';
router.post('/', companyManagementLimiter, validateRequiredFields(['name', 'owner_name', 'primary_email']), validateEmailMiddleware('primary_email'), createCompany);
router.put('/:id', updateCompany);
router.delete('/:id', companyManagementLimiter, deleteCompany);

export default router;
