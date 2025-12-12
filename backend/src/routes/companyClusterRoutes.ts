import { Router } from 'express';
import {
  getCompanyClusters,
  getAvailableClusters,
  assignCluster,
  unassignCluster,
  bulkAssignClusters,
  getCompanyClusterQuotas
} from '../controllers/companyClusterController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Company-cluster management routes
router.get('/:companyId/clusters', getCompanyClusters);
router.get('/:companyId/clusters/available', getAvailableClusters);
router.post('/:companyId/clusters', assignCluster);
router.post('/:companyId/clusters/bulk', bulkAssignClusters);
router.delete('/:companyId/clusters/:clusterId', unassignCluster);

// Cluster quotas
router.get('/:companyId/cluster-quotas', getCompanyClusterQuotas);

export default router;
