import { Router } from 'express';
import {
  getESXiHosts,
  getESXiHost,
  createESXiHost,
  updateESXiHost,
  deleteESXiHost,
  testESXiConnection,
} from '../controllers/esxiController';
import {
  initProxmoxImport,
  executeProxmoxImport,
  getImportProgress,
  cleanupProxmoxImport,
} from '../controllers/proxmoxESXiImportController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// ESXi host management routes
router.get('/', getESXiHosts);
router.get('/:id', getESXiHost);
router.post('/', createESXiHost);
router.put('/:id', updateESXiHost);
router.delete('/:id', deleteESXiHost);
router.post('/:id/test', testESXiConnection);

// Proxmox native import routes
router.post('/:id/proxmox-import/init', initProxmoxImport);
router.post('/:id/proxmox-import/execute', executeProxmoxImport);
router.get('/:id/proxmox-import/progress', getImportProgress);
router.delete('/:id/proxmox-import/cleanup', cleanupProxmoxImport);

export default router;
