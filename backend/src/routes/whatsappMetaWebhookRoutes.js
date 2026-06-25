const express = require('express');
const router = express.Router();
const { webhookLimiter } = require('../middleware/rateLimiter');
const whatsappMetaWebhookController = require('../controllers/whatsappMetaWebhookController');

router.get('/', whatsappMetaWebhookController.verificar);
router.post('/', webhookLimiter, whatsappMetaWebhookController.receber);

module.exports = router;
