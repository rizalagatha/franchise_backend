const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Hanya ada satu rute untuk login
router.post('/login', authController.login);

module.exports = router;
