const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const agendamentoController = require('../controllers/agendamentoController');

router.use(autenticar);

router.get('/', agendamentoController.listar);
router.put('/:id', agendamentoController.atualizar);
router.delete('/:id', agendamentoController.remover);

module.exports = router;
