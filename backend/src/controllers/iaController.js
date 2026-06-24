const leadModel = require('../models/leadModel');
const mensagemModel = require('../models/mensagemModel');
const iaService = require('../services/iaService');

async function responder(req, res) {
  const lead = await leadModel.buscarPorId(req.params.leadId, req.usuario.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  const { conteudo } = req.body;
  if (!conteudo) return res.status(400).json({ error: 'conteudo é obrigatório' });

  const mensagemCliente = await mensagemModel.criar({
    leadId: req.params.leadId,
    conteudo,
    enviadoPor: 'cliente',
  });

  const respostaTexto = iaService.gerarResposta(conteudo);

  const mensagemIA = await mensagemModel.criar({
    leadId: req.params.leadId,
    conteudo: respostaTexto,
    enviadoPor: 'ia',
  });

  res.status(201).json({ mensagemCliente, mensagemIA });
}

module.exports = { responder };
