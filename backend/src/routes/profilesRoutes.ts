import express from 'express';
import {
  getProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  getPermissions,
} from '../controllers/profilesController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate);

// Permissions - Must be BEFORE /:id route to avoid matching as ID
router.get('/permissions/list', getPermissions);

// Profiles
router.get('/', getProfiles);
router.get('/:id', getProfile);
router.post('/', createProfile);
router.put('/:id', updateProfile);
router.delete('/:id', deleteProfile);

export default router;
