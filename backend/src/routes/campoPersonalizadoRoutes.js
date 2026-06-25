const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const campoPersonalizadoController = require('../controllers/campoPersonalizadoController');

router.use(autenticar);

router.get('/', campoPersonalizadoController.listar);
router.post('/', campoPersonalizadoController.criar);
router.patch('/:id', campoPersonalizadoController.atualizar);
router.delete('/:id', campoPersonalizadoController.remover);

module.exports = router;
