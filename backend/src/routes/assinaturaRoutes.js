const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const assinaturaController = require('../controllers/assinaturaController');

router.use(autenticar);
router.post('/checkout', assinaturaController.checkout);
router.get('/atual', assinaturaController.atual);
router.get('/historico', assinaturaController.historico);
router.post('/cancelar', assinaturaController.cancelar);

module.exports = router;
