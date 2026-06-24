const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const relatorioController = require('../controllers/relatorioController');

router.use(autenticar);
router.get('/leads-por-origem', relatorioController.porOrigem);
router.get('/funil-conversao', relatorioController.funil);
router.get('/faturamento', relatorioController.faturamento);

module.exports = router;
