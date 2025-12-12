import { Router } from 'express';
import {
  getESXiHosts,
  getESXiHost,
  createESXiHost,
  updateESXiHost,
  deleteESXiHost,
  testESXiConnection,
  discoverVMs,
  getDiscoveredVMs,
  importVMsToProxmox,
} from '../controllers/esxiController';
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

// ESXi connection and discovery routes
router.post('/:id/test', testESXiConnection);
router.post('/:id/discover', discoverVMs);
router.get('/:id/discovered-vms', getDiscoveredVMs);
router.post('/:id/import', importVMsToProxmox);

export default router;
