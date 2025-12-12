import express from 'express';
import { getInstances, getInstance, getTemplates, downloadConfig, getConfig } from '../controllers/opnsenseController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate);
router.get('/', getInstances);
router.get('/templates', getTemplates);
router.get('/:id', getInstance);
router.get('/:id/config', getConfig);           // NEW: Get config for viewing
router.get('/:id/config/download', downloadConfig); // NEW: Download config.xml

export default router;
