const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const afiliadoController = require('../controllers/afiliadoController');

router.use(autenticar);

router.get('/me', afiliadoController.meu);
router.get('/me/comissoes', afiliadoController.minhasComissoes);

module.exports = router;
