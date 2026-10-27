const express = require('express');
const router = express.Router();
const {
  getAllReservations,
  getReservationById,
  createReservation,
  cancelReservation,
  checkoutReservation,
  returnReservation,
  settlePenalty
} = require('../controllers/reservationController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getAllReservations);
router.get('/:id', authenticate, getReservationById);
router.post('/', authenticate, createReservation);
router.put('/:id/cancel', authenticate, cancelReservation);
router.post('/:id/checkout', authenticate, authorize('custodian', 'admin'), checkoutReservation);
router.post('/:id/return', authenticate, authorize('custodian', 'admin'), returnReservation);
router.post('/:id/penalty/settle', authenticate, authorize('custodian', 'admin'), settlePenalty);

module.exports = router;
