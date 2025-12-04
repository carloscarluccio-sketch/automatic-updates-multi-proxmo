// Users routes
import { Router } from 'express';
import { getUsers, createUser } from '../controllers/usersController';
import { authenticate, requireRole } from '../middlewares/auth';

const router = Router();

router.get('/', authenticate, getUsers);
router.post('/', authenticate, requireRole('super_admin', 'company_admin'), createUser);

export default router;
