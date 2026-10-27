const express = require('express');
const router = express.Router();
const { getDashboardStats, getAuditLogs } = require('../controllers/statsController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/dashboard', authenticate, authorize('custodian', 'admin'), getDashboardStats);
router.get('/audit-logs', authenticate, authorize('custodian', 'admin'), getAuditLogs);

module.exports = router;
