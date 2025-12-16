import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  listTickets,
  getTicket,
  createTicket,
  addMessage,
  updateTicket,
  getStats
} from '../controllers/supportTicketController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Ticket management
router.get('/stats', getStats);
router.get('/', listTickets);
router.get('/:id', getTicket);
router.post('/', createTicket);
router.patch('/:id', updateTicket);

// Messages
router.post('/:id/messages', addMessage);

export default router;
