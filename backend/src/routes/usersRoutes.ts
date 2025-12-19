import express from 'express';
import { getUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/usersController';
import { authenticate } from '../middlewares/auth';
import { userManagementLimiter } from '../middlewares/rateLimiter';

const router = express.Router();

router.use(authenticate);
router.get('/', getUsers);
router.get('/:id', getUser);
import { validateRequiredFields, validateEmailMiddleware } from '../middlewares/inputValidation';
import { strictIPWhitelistMiddleware } from '../middlewares/ipWhitelist';
router.post('/', userManagementLimiter, validateRequiredFields(['username', 'email', 'password', 'role']), validateEmailMiddleware('email'), createUser);
router.put('/:id', updateUser);
router.delete('/:id', userManagementLimiter,strictIPWhitelistMiddleware, deleteUser);

export default router;
