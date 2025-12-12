import express from 'express';
import {
  getFeedback,
  getFeedbackById,
  createFeedback,
  updateFeedbackStatus,
  addFeedbackReply,
  deleteFeedback,
  getFeedbackStats,
} from '../controllers/feedbackController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

// All feedback routes require authentication
router.use(authenticate);

// Feedback CRUD
router.get('/', getFeedback);
router.get('/stats', getFeedbackStats);
router.get('/:id', getFeedbackById);
router.post('/', createFeedback);
router.put('/:id/status', updateFeedbackStatus);
router.post('/:id/reply', addFeedbackReply);
router.delete('/:id', deleteFeedback);

export default router;
