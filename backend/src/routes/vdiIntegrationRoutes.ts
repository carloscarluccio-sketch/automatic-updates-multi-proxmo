// VDI Integration Routes
import express from 'express';
import {
  getClusterDetails,
  getClusters,
  getVMDetails,
  getCompanyDetails,
  getUserDetails,
  vdiLogin,
  vdiMe,
  getTemplates,
  getUsers
} from '../controllers/vdiIntegrationController';

const router = express.Router();

// Auth endpoints
router.post('/auth/login', vdiLogin);
router.get('/auth/me', vdiMe);

// Cluster endpoints
router.get('/clusters', getClusters);
router.get('/clusters/:id', getClusterDetails);

// VM endpoints
router.get('/vms/:id', getVMDetails);

// Company endpoints
router.get('/companies/:id', getCompanyDetails);

// User endpoints
router.get('/users/:id', getUserDetails);
router.get('/users', getUsers);

// Template endpoints
router.get('/templates', getTemplates);

export default router;
