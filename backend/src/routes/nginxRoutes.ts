import express from 'express';
import { generateVHost, removeVHost, regenerateAllVHosts } from '../controllers/nginxVHostController';
import { authenticate, requireRole } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate);
router.use(requireRole('super_admin')); // All nginx operations require super_admin

// Generate virtual host for a specific mapping
router.post('/generate-vhost/:mapping_id', generateVHost);

// Remove virtual host for a specific mapping
router.delete('/vhost/:mapping_id', removeVHost);

// Regenerate all virtual hosts
router.post('/regenerate-all', regenerateAllVHosts);

export default router;
