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
const adminRoutes = require('./adminRoutes');
const suporteRoutes = require('./suporteRoutes');
const webhookRoutes = require('./webhookRoutes');
const produtoRoutes = require('./produtoRoutes');
const catalogoPublicoRoutes = require('./catalogoPublicoRoutes');
const campoPersonalizadoRoutes = require('./campoPersonalizadoRoutes');
const leadCampoPersonalizadoRoutes = require('./leadCampoPersonalizadoRoutes');

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
router.use('/admin', adminRoutes);
router.use('/suporte', suporteRoutes);
router.use('/integracoes', webhookRoutes);
router.use('/catalogo', produtoRoutes);
router.use('/catalogo-publico/:slug', catalogoPublicoRoutes);
router.use('/campos-personalizados', campoPersonalizadoRoutes);
router.use('/leads/:leadId/campos-personalizados', leadCampoPersonalizadoRoutes);

module.exports = router;
