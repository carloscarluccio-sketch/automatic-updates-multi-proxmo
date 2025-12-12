import express from 'express';
import {
  getSSOConfig,
  upsertSSOConfig,
  deleteSSOConfig,
  testSSOConnection,
  getSSOAuditLogs,
} from '../controllers/ssoController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

// All SSO routes require authentication
router.use(authenticate);

// SSO Configuration
router.get('/config/:companyId?', getSSOConfig);
router.post('/config', upsertSSOConfig);
router.put('/config', upsertSSOConfig); // Alias for upsert
router.delete('/config/:id', deleteSSOConfig);
router.post('/test/:id', testSSOConnection);

// SSO Audit Logs
router.get('/audit', getSSOAuditLogs);

export default router;
