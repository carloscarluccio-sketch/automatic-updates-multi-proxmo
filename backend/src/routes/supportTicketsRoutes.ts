import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  addMessage,
  getTicketStats
} from '../controllers/supportTicketsController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Statistics
router.get('/stats', getTicketStats);

// Ticket CRUD
router.get('/', listTickets);
router.get('/:id', getTicket);
router.post('/', createTicket);
router.patch('/:id', updateTicket);

// Messages
router.post('/:id/messages', addMessage);

export default router;
