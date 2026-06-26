const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const npsController = require('../controllers/npsController');

router.use(autenticar);

router.get('/elegivel', npsController.elegivel);
router.post('/', npsController.criar);
router.post('/dispensar', npsController.dispensar);

module.exports = router;
