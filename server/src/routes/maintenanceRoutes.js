const express = require('express');
const router = express.Router();
const {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket
} = require('../controllers/maintenanceController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getAllTickets);
router.get('/:id', authenticate, getTicketById);
router.post('/', authenticate, authorize('custodian', 'admin'), createTicket);
router.put('/:id', authenticate, authorize('custodian', 'admin'), updateTicket);

module.exports = router;
