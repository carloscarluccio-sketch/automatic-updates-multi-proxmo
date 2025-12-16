import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  getNotificationSettings,
  updateNotificationSetting,
  bulkUpdateSettings,
  toggleAllEmail,
  getNotificationCategories
} from '../controllers/notificationSettingsController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get categories summary
router.get('/categories', getNotificationCategories);

// Bulk operations
router.post('/bulk', bulkUpdateSettings);
router.post('/toggle-all-email', toggleAllEmail);

// CRUD operations
router.get('/', getNotificationSettings);
router.patch('/:id', updateNotificationSetting);

export default router;
