import express from 'express';
import {
  listBackups,
  triggerBackup,
  deleteBackup,
  downloadBackup
} from '../controllers/databaseBackupController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate);

// List all backups (super_admin only)
router.get('/', listBackups);

// Trigger manual backup (super_admin only)
router.post('/trigger', triggerBackup);

// Download backup file (super_admin only)
router.get('/download/:filename', downloadBackup);

// Delete backup (super_admin only)
router.delete('/:filename', deleteBackup);

export default router;
