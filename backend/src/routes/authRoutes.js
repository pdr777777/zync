const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', autenticar, authController.me);
router.put('/me', autenticar, authController.atualizarMe);

module.exports = router;
