/**
 * IP Reservations Routes
 * Phase 2.1: IP Reservation System
 */

import { Router } from 'express';
import {
  createReservation,
  listReservations,
  getReservation,
  updateReservation,
  cancelReservation,
  fulfillReservation,
  cleanupExpiredReservations,
  checkAvailability,
} from '../controllers/ipReservationsController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// CRUD operations
router.post('/', createReservation);
router.get('/', listReservations);
router.get('/check-availability', checkAvailability);
router.get('/:id', getReservation);
router.put('/:id', updateReservation);
router.delete('/:id', cancelReservation);

// Special actions
router.post('/:id/fulfill', fulfillReservation);
router.post('/cleanup', cleanupExpiredReservations);

export default router;
