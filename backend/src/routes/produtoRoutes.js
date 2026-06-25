const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const produtoController = require('../controllers/produtoController');

router.use(autenticar);

router.get('/', produtoController.listar);
router.post('/', produtoController.criar);
router.get('/link', produtoController.obterLink);
router.patch('/:id', produtoController.atualizar);
router.delete('/:id', produtoController.remover);

module.exports = router;
