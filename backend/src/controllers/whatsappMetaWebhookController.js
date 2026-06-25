const crypto = require('crypto');
const usuarioModel = require('../models/usuarioModel');
const whatsappController = require('./whatsappController');
const asyncHandler = require('../utils/asyncHandler');

function verificar(req, res) {
  const modo = req.query['hub.mode'];
  const tokenRecebido = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const tokenEsperado = process.env.WHATSAPP_VERIFY_TOKEN;

  if (modo === 'subscribe' && tokenEsperado && tokenRecebido === tokenEsperado) {
    return res.status(200).send(challenge);
  }

  res.status(403).send('Token de verificação inválido');
}

function assinaturaValida(req) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const assinaturaRecebida = req.headers['x-hub-signature-256'];
  if (!appSecret || !assinaturaRecebida || !req.rawBody) return false;

  const esperada = `sha256=${crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex')}`;
  const bufEsperado = Buffer.from(esperada);
  const bufRecebido = Buffer.from(assinaturaRecebida);

  return bufEsperado.length === bufRecebido.length && crypto.timingSafeEqual(bufEsperado, bufRecebido);
}

async function receber(req, res) {
  if (!process.env.WHATSAPP_APP_SECRET) {
    console.error('WHATSAPP_APP_SECRET não configurada — bloqueando webhook por segurança');
    return res.status(503).json({ error: 'Webhook não configurado' });
  }

  if (!assinaturaValida(req)) {
    return res.status(401).json({ error: 'Assinatura inválida' });
  }

  const entradas = req.body?.entry || [];

  for (const entrada of entradas) {
    for (const mudanca of entrada.changes || []) {
      const valor = mudanca.value || {};
      const phoneNumberId = valor.metadata?.phone_number_id;
      const mensagens = valor.messages || [];

      if (!phoneNumberId || mensagens.length === 0) continue;

      const usuario = await usuarioModel.buscarPorWhatsappPhoneNumberId(phoneNumberId);
      if (!usuario) {
        console.error(`Webhook do WhatsApp: nenhum usuário com phone_number_id ${phoneNumberId}`);
        continue;
      }

      const contato = (valor.contacts || [])[0];

      for (const mensagem of mensagens) {
        if (mensagem.type !== 'text' || !mensagem.text?.body) continue;

        await whatsappController.processarMensagemRecebida({
          usuarioId: usuario.id,
          telefone: mensagem.from,
          nome: contato?.profile?.name,
          mensagem: mensagem.text.body,
        });
      }
    }
  }

  res.status(200).send();
}

module.exports = { verificar, receber: asyncHandler(receber) };
