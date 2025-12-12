import express from 'express';
import {
  getBranding,
  updateBranding,
  getURLMappings,
  getURLMapping,
  createURLMapping,
  updateURLMapping,
  deleteURLMapping,
} from '../controllers/brandingController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate);

// Branding routes
router.get('/branding/:companyId?', getBranding);
router.put('/branding/:companyId?', updateBranding);

// URL Mapping routes
router.get('/url-mappings', getURLMappings);
router.get('/url-mappings/:id', getURLMapping);
router.post('/url-mappings', createURLMapping);
router.put('/url-mappings/:id', updateURLMapping);
router.delete('/url-mappings/:id', deleteURLMapping);

export default router;
