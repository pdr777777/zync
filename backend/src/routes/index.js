const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const leadRoutes = require('./leadRoutes');
const mensagemRoutes = require('./mensagemRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const iaRoutes = require('./iaRoutes');
const whatsappRoutes = require('./whatsappRoutes');
const whatsappWebhookRoutes = require('./whatsappWebhookRoutes');

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/leads', leadRoutes);
router.use('/leads/:leadId/mensagens', mensagemRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/leads/:leadId/ia', iaRoutes);
router.use('/leads/:leadId/whatsapp', whatsappRoutes);
router.use('/webhooks/whatsapp/:usuarioId', whatsappWebhookRoutes);

module.exports = router;
