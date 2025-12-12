import express from 'express';
import {
  testSMTPConnection,
  sendTestEmail,
  processQueue,
  getQueueStatus,
  getNotificationSettings,
  updateNotificationSettings,
  cancelQueuedEmail,
} from '../controllers/notificationController';
import { authenticate, requireRole } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate);

// SMTP testing (super_admin only)
router.post('/test-smtp', requireRole('super_admin'), testSMTPConnection);
router.post('/send-test-email', requireRole('super_admin'), sendTestEmail);

// Queue management
router.post('/process-queue', requireRole('super_admin'), processQueue);
router.get('/queue', getQueueStatus);
router.delete('/queue/:id', cancelQueuedEmail);

// Notification settings (user-specific)
router.get('/settings', getNotificationSettings);
router.post('/settings', updateNotificationSettings);

export default router;
