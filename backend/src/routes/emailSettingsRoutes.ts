import express from 'express';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// SMTP Settings (super_admin only)

// Email From Settings (super_admin only)

// Queue Management (super_admin only)

// Test Email (super_admin only)

export default router;
