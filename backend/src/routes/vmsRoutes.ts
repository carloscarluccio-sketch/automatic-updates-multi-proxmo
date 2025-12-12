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
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate);

// List all VMs
router.get('/', getVMs);

// Sync VMs with Proxmox (check existence)
router.post('/sync', syncVMs);

// Purge ghost VMs (mark as deleted if not in Proxmox)
router.post('/purge', purgeGhostVMs);

// Get single VM
router.get('/:id', getVM);

// Get VM status from Proxmox
router.get('/:id/status', getVMStatus);

// Get console URL for VM
router.get('/:id/console', getVMConsole);

// Create new VM
router.post('/', createVM);

// Clone VM
router.post('/:id/clone', cloneVM);

// Control VM (start/stop/restart)
router.post('/:id/control', controlVM);

// Assign VM to project (or unassign if project_id is null)
router.post('/:id/assign-project', assignVMToProject);

// Update VM
router.put('/:id', updateVM);

// Delete VM
router.delete('/:id', deleteVM);

export default router;
