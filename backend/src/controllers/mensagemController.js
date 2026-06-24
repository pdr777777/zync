const mensagemModel = require('../models/mensagemModel');
const leadModel = require('../models/leadModel');
const asyncHandler = require('../utils/asyncHandler');
const validators = require('../utils/validators');

async function listar(req, res) {
  const lead = await leadModel.buscarPorId(req.params.leadId, req.usuario.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  const mensagens = await mensagemModel.listarPorLead(req.params.leadId);
  res.json(mensagens);
}

async function criar(req, res) {
  const lead = await leadModel.buscarPorId(req.params.leadId, req.usuario.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  const { conteudo, enviado_por } = req.body;
  if (!conteudo || !enviado_por) {
    return res.status(400).json({ error: 'conteudo e enviado_por são obrigatórios' });
  }

  if (!validators.ENVIADO_POR.includes(enviado_por)) {
    return res.status(400).json({ error: `enviado_por deve ser um de: ${validators.ENVIADO_POR.join(', ')}` });
  }

  const mensagem = await mensagemModel.criar({ leadId: req.params.leadId, conteudo, enviadoPor: enviado_por });
  res.status(201).json(mensagem);
}

module.exports = { listar: asyncHandler(listar), criar: asyncHandler(criar) };
