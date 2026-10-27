const express = require('express');
const router = express.Router();
const { register, login, getProfile, getAllUsers } = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getProfile);
router.get('/users', authenticate, authorize('custodian', 'admin'), getAllUsers);

module.exports = router;
