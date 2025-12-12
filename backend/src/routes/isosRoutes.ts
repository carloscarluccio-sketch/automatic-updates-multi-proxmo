import express from 'express';
import {
  getISOs,
  getISO,
  createISO,
  updateISO,
  deleteISO,
} from '../controllers/isosController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

router.use(authenticate);

router.get('/', getISOs);
router.get('/:id', getISO);
router.post('/', createISO);
router.put('/:id', updateISO);
router.delete('/:id', deleteISO);

export default router;
