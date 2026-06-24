const express = require('express');
const router = express.Router({ mergeParams: true });
const autenticar = require('../middleware/authMiddleware');
const agendamentoController = require('../controllers/agendamentoController');

router.use(autenticar);

router.get('/', agendamentoController.listarDoLead);
router.post('/', agendamentoController.criar);

module.exports = router;
