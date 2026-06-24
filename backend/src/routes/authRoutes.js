const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const authController = require('../controllers/authController');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/esqueci-senha', authLimiter, authController.esqueciSenha);
router.post('/redefinir-senha', authLimiter, authController.redefinirSenha);
router.get('/me', autenticar, authController.me);
router.put('/me', autenticar, authController.atualizarMe);
router.post('/logout-everywhere', autenticar, authController.logoutEverywhere);

module.exports = router;
