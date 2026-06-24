const agendamentoModel = require('../models/agendamentoModel');
const leadModel = require('../models/leadModel');
const asyncHandler = require('../utils/asyncHandler');
const validators = require('../utils/validators');

function validarDadosAgendamento(dados) {
  if (dados.data_hora !== undefined && !validators.dataValida(dados.data_hora)) {
    return 'data_hora inválida';
  }

  if (dados.status !== undefined && !validators.STATUS_AGENDAMENTO.includes(dados.status)) {
    return `status deve ser um de: ${validators.STATUS_AGENDAMENTO.join(', ')}`;
  }

  return null;
}

async function listar(req, res) {
  const agendamentos = await agendamentoModel.listarPorUsuario(req.usuario.id);
  res.json(agendamentos);
}

async function listarDoLead(req, res) {
  const lead = await leadModel.buscarPorId(req.params.leadId, req.usuario.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  const agendamentos = await agendamentoModel.listarPorLead(req.params.leadId, req.usuario.id);
  res.json(agendamentos);
}

async function criar(req, res) {
  const lead = await leadModel.buscarPorId(req.params.leadId, req.usuario.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  const { servico, data_hora } = req.body;
  if (!data_hora) return res.status(400).json({ error: 'data_hora é obrigatório' });

  const erro = validarDadosAgendamento(req.body);
  if (erro) return res.status(400).json({ error: erro });

  const agendamento = await agendamentoModel.criar({
    usuarioId: req.usuario.id,
    leadId: req.params.leadId,
    servico,
    data_hora,
  });

  res.status(201).json(agendamento);
}

async function atualizar(req, res) {
  const agendamento = await agendamentoModel.buscarPorId(req.params.id, req.usuario.id);
  if (!agendamento) return res.status(404).json({ error: 'Agendamento não encontrado' });

  const erro = validarDadosAgendamento(req.body);
  if (erro) return res.status(400).json({ error: erro });

  const atualizado = await agendamentoModel.atualizar(req.params.id, req.usuario.id, req.body);
  res.json(atualizado);
}

async function remover(req, res) {
  const agendamento = await agendamentoModel.buscarPorId(req.params.id, req.usuario.id);
  if (!agendamento) return res.status(404).json({ error: 'Agendamento não encontrado' });

  await agendamentoModel.remover(req.params.id, req.usuario.id);
  res.status(204).send();
}

module.exports = {
  listar: asyncHandler(listar),
  listarDoLead: asyncHandler(listarDoLead),
  criar: asyncHandler(criar),
  atualizar: asyncHandler(atualizar),
  remover: asyncHandler(remover),
};
