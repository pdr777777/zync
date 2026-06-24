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
const logRoutes = require('./logRoutes');
const notificacaoRoutes = require('./notificacaoRoutes');
const planoRoutes = require('./planoRoutes');
const assinaturaRoutes = require('./assinaturaRoutes');
const syncpayWebhookRoutes = require('./syncpayWebhookRoutes');
const relatorioRoutes = require('./relatorioRoutes');

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
router.use('/logs', logRoutes);
router.use('/notificacoes', notificacaoRoutes);
router.use('/planos', planoRoutes);
router.use('/assinaturas', assinaturaRoutes);
router.use('/webhooks/syncpay', syncpayWebhookRoutes);
router.use('/relatorios', relatorioRoutes);

module.exports = router;
