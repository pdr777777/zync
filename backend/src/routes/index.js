const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const leadRoutes = require('./leadRoutes');
const mensagemRoutes = require('./mensagemRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const iaRoutes = require('./iaRoutes');
const whatsappRoutes = require('./whatsappRoutes');
const whatsappWebhookRoutes = require('./whatsappWebhookRoutes');
const tagRoutes = require('./tagRoutes');
const leadTagRoutes = require('./leadTagRoutes');
const agendamentoRoutes = require('./agendamentoRoutes');
const leadAgendamentoRoutes = require('./leadAgendamentoRoutes');

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
router.use('/tags', tagRoutes);
router.use('/leads/:leadId/tags', leadTagRoutes);
router.use('/agendamentos', agendamentoRoutes);
router.use('/leads/:leadId/agendamentos', leadAgendamentoRoutes);

module.exports = router;
