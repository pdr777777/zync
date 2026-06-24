const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const tagController = require('../controllers/tagController');

router.use(autenticar);

router.get('/', tagController.listar);
router.post('/', tagController.criar);
router.delete('/:id', tagController.remover);

module.exports = router;
