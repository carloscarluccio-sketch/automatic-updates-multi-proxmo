import { Router } from 'express';
import { getJobStatus, listJobs, cancelJob } from '../controllers/jobsController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All job routes require authentication
router.use(authenticate);

// Get job status
router.get('/:jobId/status', getJobStatus);

// List jobs with filters
router.get('/', listJobs);

// Cancel job
router.delete('/:jobId', cancelJob);

export default router;
