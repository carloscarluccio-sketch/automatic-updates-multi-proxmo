import express from 'express';
import multer from 'multer';
import {
  getISOs,
  getISO,
  createISO,
  updateISO,
  deleteISO,
} from '../controllers/isosController';
import { uploadISO } from '../controllers/isoUploadController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/iso-uploads',
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB max
  },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.iso')) {
      cb(null, true);
    } else {
      cb(new Error('Only .iso files are allowed'));
    }
  }
});

router.use(authenticate);

// Upload route (must be before generic routes)
router.post('/upload', upload.single('file'), uploadISO);

router.get('/', getISOs);
router.get('/:id', getISO);
router.post('/', createISO);
router.put('/:id', updateISO);
router.delete('/:id', deleteISO);

export default router;
