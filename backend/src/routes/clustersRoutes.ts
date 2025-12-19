import express from 'express';
import {
  getClusters,
  getCluster,
  createCluster,
  updateCluster,
  deleteCluster,
  testConnection,
  getClusterNodes,
  getClusterStorages,
  getClusterISOs,
  getClusterTemplates,
  getNextVMID,
  generateSSHKeys,
  getSSHPublicKey,
  getSSHKeyStatus,
  pushSSHKey,
  rotateSSHKeys,
} from '../controllers/clustersController';
import {
  getSSHKeyHealth,
  setSSHKeyExpiration,
  getSSHKeyClusterDetails,
} from '../controllers/sshKeyHealthController';
import { authenticate } from '../middlewares/auth';
import { strictIPWhitelistMiddleware } from '../middlewares/ipWhitelist';

const router = express.Router();
router.use(authenticate);
router.get('/', getClusters);
router.get('/:id', getCluster);
router.post('/', createCluster);
router.put('/:id', updateCluster);
router.delete('/:id', strictIPWhitelistMiddleware, deleteCluster);
router.post('/:id/test-connection', testConnection);
router.get('/:id/nodes', getClusterNodes);
router.get('/:id/nodes/:node/storages', getClusterStorages);
router.get('/:id/nodes/:node/isos', getClusterISOs);
router.get('/:id/nodes/:node/templates', getClusterTemplates);
router.get('/:id/nextid', getNextVMID);

// SSH Key Management Routes
router.post('/generate-ssh-keys', generateSSHKeys);
router.get('/ssh-public-key', getSSHPublicKey);
router.get('/:id/ssh-key-status', getSSHKeyStatus);
router.post('/:id/push-ssh-key', pushSSHKey);
router.post('/rotate-ssh-keys', rotateSSHKeys);

// SSH Key Health Monitoring Routes
router.get('/ssh-keys/health', getSSHKeyHealth);
router.post('/ssh-keys/set-expiration', setSSHKeyExpiration);
router.get('/ssh-keys/cluster-details', getSSHKeyClusterDetails);

export default router;
