import express from 'express';
import {
  getVMs,
  getVM,
  createVM,
  updateVM,
  deleteVM,
  getVMStatus,
  controlVM,
  cloneVM,
  getVMConsole,
  syncVMs,
  purgeGhostVMs,
  assignVMToProject
} from '../controllers/vmsController';
import {
  updateAutoShutdown,
  getAutoShutdownStats,
  listAutoShutdownVMs
} from '../controllers/vmAutoShutdownController';
import { authenticate } from '../middlewares/auth';
import { trackVMActivity } from '../middlewares/vmActivityMiddleware';
import { bulkVMAction, bulkVMUpdate } from '../controllers/bulkVMController';

const router = express.Router();

router.use(authenticate);
// Bulk operations
router.post('/bulk-action', bulkVMAction);
router.patch('/bulk-update', bulkVMUpdate);

// List all VMs
router.get('/', getVMs);

// Sync VMs with Proxmox (check existence)
router.post('/sync', syncVMs);

// Purge ghost VMs (VMs in DB but not in Proxmox)
router.post('/purge-ghosts', purgeGhostVMs);

// Get single VM (with activity tracking)
router.get('/:id', trackVMActivity, getVM);

// Get VM status (with activity tracking)
router.get('/:id/status', trackVMActivity, getVMStatus);

// Get VM console URL (with activity tracking)
router.get('/:id/console', trackVMActivity, getVMConsole);

// Create VM
router.post('/', createVM);

// Clone VM (with activity tracking for source VM)
router.post('/:id/clone', trackVMActivity, cloneVM);

// Control VM - start/stop/restart (with activity tracking)
router.post('/:id/control', trackVMActivity, controlVM);

// Assign VM to project (with activity tracking)
router.post('/:id/assign-project', trackVMActivity, assignVMToProject);

// Auto-shutdown routes
router.get('/auto-shutdown/stats', getAutoShutdownStats);
router.get('/auto-shutdown/list', listAutoShutdownVMs);
router.patch('/:id/auto-shutdown', updateAutoShutdown);

// Update VM (with activity tracking)
router.put('/:id', trackVMActivity, updateVM);

// Delete VM (activity tracking not needed for deletion)
router.delete('/:id', deleteVM);

export default router;
