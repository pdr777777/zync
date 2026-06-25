const express = require('express');
const router = express.Router({ mergeParams: true });
const { catalogoPublicoLimiter } = require('../middleware/rateLimiter');
const produtoController = require('../controllers/produtoController');

router.get('/', produtoController.catalogoPublico);
router.post('/solicitar', catalogoPublicoLimiter, produtoController.solicitar);

module.exports = router;
