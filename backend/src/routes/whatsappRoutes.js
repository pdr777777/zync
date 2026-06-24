const express = require('express');
const router = express.Router({ mergeParams: true });
const autenticar = require('../middleware/authMiddleware');
const whatsappController = require('../controllers/whatsappController');

router.use(autenticar);

router.post('/enviar', whatsappController.enviarManual);

module.exports = router;
