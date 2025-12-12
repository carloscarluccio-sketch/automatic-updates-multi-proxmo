import express from 'express';
import {
  getIPRanges,
  getIPRange,
  createIPRange,
  updateIPRange,
  deleteIPRange,
  getAvailableIPs,
} from '../controllers/ipRangesController';
import {
  validateIP,
  getAvailableIPs as getAvailableIPsList,
  suggestNextIP,
} from '../controllers/ipConflictValidator';
import { authenticate } from '../middlewares/auth';

const router = express.Router();
router.use(authenticate);

// Existing routes
router.get('/', getIPRanges);
router.get('/:id', getIPRange);
router.get('/:id/available', getAvailableIPs);
router.post('/', createIPRange);
router.put('/:id', updateIPRange);
router.delete('/:id', deleteIPRange);

// New IP validation and conflict detection routes
router.post('/validate-ip', validateIP);
router.get('/:id/available-ips', getAvailableIPsList);
router.get('/:id/suggest-ip', suggestNextIP);

export default router;
