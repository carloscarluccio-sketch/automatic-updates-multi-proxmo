import express from 'express';
import { calculateSubnet, suggestSubnets, validateIPInSubnet } from '../controllers/subnetCalculatorController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate);

// Calculate subnet information from CIDR
router.post('/calculate', calculateSubnet);

// Suggest subnet subdivisions
router.post('/suggest-subnets', suggestSubnets);

// Validate if IP is within subnet
router.post('/validate-ip-in-subnet', validateIPInSubnet);

export default router;
