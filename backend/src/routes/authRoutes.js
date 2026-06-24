const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const authController = require('../controllers/authController');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/me', autenticar, authController.me);
router.put('/me', autenticar, authController.atualizarMe);

module.exports = router;
