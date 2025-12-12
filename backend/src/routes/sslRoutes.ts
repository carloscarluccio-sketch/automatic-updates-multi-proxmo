import express from 'express';
import { generateLetsEncrypt, getCertificateStatus, uploadCertificate } from '../controllers/sslController';
import { authenticate, requireRole } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate);

// LetsEncrypt certificate generation (super_admin and company_admin)
router.post('/generate-letsencrypt', requireRole('super_admin', 'company_admin'), generateLetsEncrypt);

// Get SSL certificate status
router.get('/status/:mapping_id', getCertificateStatus);

// Manual certificate upload (super_admin and company_admin)
router.post('/upload', requireRole('super_admin', 'company_admin'), uploadCertificate);

export default router;
