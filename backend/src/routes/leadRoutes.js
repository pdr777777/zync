const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const leadController = require('../controllers/leadController');

router.use(autenticar);

router.get('/', leadController.listar);
router.get('/inbox', leadController.inbox);
router.get('/export', leadController.exportarCsv);
router.post('/importar', leadController.importar);
router.get('/:id', leadController.buscar);
router.post('/', leadController.criar);
router.put('/:id', leadController.atualizar);
router.delete('/:id', leadController.remover);

module.exports = router;
