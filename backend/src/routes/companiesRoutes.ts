import express from 'express';
import { getCompanies, getCompany, createCompany, updateCompany, deleteCompany } from '../controllers/companiesController';
import { authenticate } from '../middlewares/auth';
import { companyManagementLimiter } from '../middlewares/rateLimiter';
import { validateRequiredFields, validateEmailMiddleware } from '../middlewares/inputValidation';
import { strictIPWhitelistMiddleware } from '../middlewares/ipWhitelist';

const router = express.Router();

router.use(authenticate);
router.get('/', getCompanies);
router.get('/:id', getCompany);
router.post('/', companyManagementLimiter, validateRequiredFields(['name', 'owner_name', 'primary_email']), validateEmailMiddleware('primary_email'), createCompany);
router.put('/:id', updateCompany);
router.delete('/:id', companyManagementLimiter, strictIPWhitelistMiddleware, deleteCompany);

export default router;
