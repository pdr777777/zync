const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const suporteController = require('../controllers/suporteController');

router.use(autenticar);
router.get('/', suporteController.listar);
router.post('/', suporteController.criar);

module.exports = router;
