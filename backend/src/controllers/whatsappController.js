const leadModel = require('../models/leadModel');
const mensagemModel = require('../models/mensagemModel');
const notificacaoModel = require('../models/notificacaoModel');
const iaService = require('../services/iaService');
const whatsappService = require('../services/whatsappService');
const asyncHandler = require('../utils/asyncHandler');

async function processarMensagemRecebida({ usuarioId, telefone, nome, mensagem }) {
  let lead = await leadModel.buscarPorTelefone(telefone, usuarioId);
  if (!lead) {
    lead = await leadModel.criar({
      usuarioId,
      nome: nome || telefone,
      origem: 'WhatsApp',
      telefone,
    });
  }

  await mensagemModel.criar({ leadId: lead.id, conteudo: mensagem, enviadoPor: 'cliente' });

  await notificacaoModel.criar({
    usuarioId,
    leadId: lead.id,
    tipo: 'mensagem_recebida',
    mensagem: `${lead.nome} enviou uma mensagem`,
  });

  const respostaTexto = await iaService.gerarResposta(mensagem);
  await mensagemModel.criar({ leadId: lead.id, conteudo: respostaTexto, enviadoPor: 'ia' });

  await whatsappService.enviarMensagem(telefone, respostaTexto);

  return lead;
}

async function receberMensagem(req, res) {
  const { usuarioId } = req.params;
  const { telefone, nome, mensagem } = req.body;

  if (!telefone || !mensagem) {
    return res.status(400).json({ error: 'telefone e mensagem são obrigatórios' });
  }

  await processarMensagemRecebida({ usuarioId, telefone, nome, mensagem });

  res.status(200).json({ ok: true });
}

async function enviarManual(req, res) {
  const lead = await leadModel.buscarPorId(req.params.leadId, req.usuario.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
  if (!lead.telefone) return res.status(400).json({ error: 'Lead não possui telefone cadastrado' });

  const { conteudo } = req.body;
  if (!conteudo) return res.status(400).json({ error: 'conteudo é obrigatório' });

  const mensagem = await mensagemModel.criar({ leadId: lead.id, conteudo, enviadoPor: 'humano' });
  await whatsappService.enviarMensagem(lead.telefone, conteudo);

  res.status(201).json(mensagem);
}

module.exports = {
  processarMensagemRecebida,
  receberMensagem: asyncHandler(receberMensagem),
  enviarManual: asyncHandler(enviarManual),
};
