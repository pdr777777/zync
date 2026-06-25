const tagModel = require('../models/tagModel');
const leadModel = require('../models/leadModel');
const logModel = require('../models/logModel');
const asyncHandler = require('../utils/asyncHandler');
const validators = require('../utils/validators');

async function listar(req, res) {
  const tags = await tagModel.listarPorUsuario(req.usuario.id);
  res.json(tags);
}

async function criar(req, res) {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ error: 'nome é obrigatório' });
  if (!validators.dentroDoTamanho(nome, 60)) return res.status(400).json({ error: 'nome deve ter no máximo 60 caracteres' });

  const tag = await tagModel.criar({ usuarioId: req.usuario.id, nome });
  res.status(201).json(tag);
}

async function remover(req, res) {
  const tag = await tagModel.buscarPorId(req.params.id, req.usuario.id);
  if (!tag) return res.status(404).json({ error: 'Tag não encontrada' });

  await tagModel.remover(req.params.id, req.usuario.id);
  res.status(204).send();
}

async function listarDoLead(req, res) {
  const lead = await leadModel.buscarPorId(req.params.leadId, req.usuario.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  const tags = await tagModel.listarPorLead(req.params.leadId);
  res.json(tags);
}

async function associarAoLead(req, res) {
  const lead = await leadModel.buscarPorId(req.params.leadId, req.usuario.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  const { tagId } = req.body;
  if (!tagId) return res.status(400).json({ error: 'tagId é obrigatório' });

  const tag = await tagModel.buscarPorId(tagId, req.usuario.id);
  if (!tag) return res.status(404).json({ error: 'Tag não encontrada' });

  await tagModel.associarLead(req.params.leadId, tagId);

  await logModel.registrar({
    usuarioId: req.usuario.id,
    leadId: lead.id,
    acao: 'tag_associada',
    detalhes: { tagId: tag.id, nome: tag.nome },
  });

  res.status(201).json({ ok: true });
}

async function desassociarDoLead(req, res) {
  const lead = await leadModel.buscarPorId(req.params.leadId, req.usuario.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  await tagModel.desassociarLead(req.params.leadId, req.params.tagId);

  await logModel.registrar({
    usuarioId: req.usuario.id,
    leadId: lead.id,
    acao: 'tag_removida',
    detalhes: { tagId: req.params.tagId },
  });

  res.status(204).send();
}

module.exports = {
  listar: asyncHandler(listar),
  criar: asyncHandler(criar),
  remover: asyncHandler(remover),
  listarDoLead: asyncHandler(listarDoLead),
  associarAoLead: asyncHandler(associarAoLead),
  desassociarDoLead: asyncHandler(desassociarDoLead),
};
