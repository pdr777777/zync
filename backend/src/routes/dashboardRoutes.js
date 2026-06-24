const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const dashboardController = require('../controllers/dashboardController');

router.use(autenticar);

router.get('/', dashboardController.obterMetricas);

module.exports = router;
