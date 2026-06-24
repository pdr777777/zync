const express = require('express');
const router = express.Router({ mergeParams: true });
const { webhookLimiter } = require('../middleware/rateLimiter');
const whatsappController = require('../controllers/whatsappController');

router.post('/', webhookLimiter, whatsappController.receberMensagem);

module.exports = router;
