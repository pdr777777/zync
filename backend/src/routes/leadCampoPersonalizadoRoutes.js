const express = require('express');
const router = express.Router({ mergeParams: true });
const autenticar = require('../middleware/authMiddleware');
const campoPersonalizadoController = require('../controllers/campoPersonalizadoController');

router.use(autenticar);

router.get('/', campoPersonalizadoController.listarValoresDoLead);
router.put('/:campoId', campoPersonalizadoController.definirValorDoLead);
router.delete('/:campoId', campoPersonalizadoController.removerValorDoLead);

module.exports = router;
