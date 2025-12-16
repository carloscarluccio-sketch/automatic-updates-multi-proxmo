import express from 'express';
import { authenticate } from '../middlewares/auth';
import {
  deployNginxConfig,
  removeNginxConfig,
  testNginxConfig,
  reloadNginx,
  previewNginxConfig,
} from '../controllers/nginxController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Deploy Nginx configuration for a URL mapping
router.post('/url-mappings/:id/deploy', deployNginxConfig);

// Remove Nginx configuration for a URL mapping
router.delete('/url-mappings/:id/deploy', removeNginxConfig);

// Test Nginx configuration (super_admin only)
router.get('/test', testNginxConfig);

// Reload Nginx (super_admin only)
router.post('/reload', reloadNginx);

// Generate configuration preview
router.post('/preview', previewNginxConfig);

export default router;
