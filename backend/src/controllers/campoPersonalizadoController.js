const campoPersonalizadoModel = require('../models/campoPersonalizadoModel');
const leadModel = require('../models/leadModel');
const asyncHandler = require('../utils/asyncHandler');
const validators = require('../utils/validators');

const TIPOS_CAMPO = ['texto', 'numero', 'data', 'selecao'];

async function listar(req, res) {
  const campos = await campoPersonalizadoModel.listarPorUsuario(req.usuario.id);
  res.json(campos);
}

async function criar(req, res) {
  const { nome, tipo, opcoes } = req.body;

  if (!nome) return res.status(400).json({ error: 'nome é obrigatório' });
  if (!validators.dentroDoTamanho(nome, 60)) return res.status(400).json({ error: 'nome deve ter no máximo 60 caracteres' });
  if (!TIPOS_CAMPO.includes(tipo)) return res.status(400).json({ error: `tipo deve ser um de: ${TIPOS_CAMPO.join(', ')}` });

  if (tipo === 'selecao') {
    if (!Array.isArray(opcoes) || opcoes.length === 0) {
      return res.status(400).json({ error: 'opcoes deve ser uma lista com pelo menos um item quando tipo é selecao' });
    }
    if (!opcoes.every((o) => typeof o === 'string' && validators.dentroDoTamanho(o, 60))) {
      return res.status(400).json({ error: 'cada opção deve ter no máximo 60 caracteres' });
    }
  }

  const campo = await campoPersonalizadoModel.criar({
    usuarioId: req.usuario.id,
    nome,
    tipo,
    opcoes: tipo === 'selecao' ? opcoes : null,
  });
  res.status(201).json(campo);
}

async function atualizar(req, res) {
  const campo = await campoPersonalizadoModel.buscarPorId(req.params.id, req.usuario.id);
  if (!campo) return res.status(404).json({ error: 'Campo não encontrado' });

  const { nome, opcoes } = req.body;

  if (nome !== undefined) {
    if (!nome) return res.status(400).json({ error: 'nome é obrigatório' });
    if (!validators.dentroDoTamanho(nome, 60)) return res.status(400).json({ error: 'nome deve ter no máximo 60 caracteres' });
  }

  if (opcoes !== undefined) {
    if (campo.tipo !== 'selecao') return res.status(400).json({ error: 'opcoes só pode ser definido em campos do tipo selecao' });
    if (!Array.isArray(opcoes) || opcoes.length === 0) {
      return res.status(400).json({ error: 'opcoes deve ser uma lista com pelo menos um item' });
    }
    if (!opcoes.every((o) => typeof o === 'string' && validators.dentroDoTamanho(o, 60))) {
      return res.status(400).json({ error: 'cada opção deve ter no máximo 60 caracteres' });
    }
  }

  const atualizado = await campoPersonalizadoModel.atualizar(req.params.id, req.usuario.id, { nome, opcoes });
  res.json(atualizado);
}

async function remover(req, res) {
  const campo = await campoPersonalizadoModel.buscarPorId(req.params.id, req.usuario.id);
  if (!campo) return res.status(404).json({ error: 'Campo não encontrado' });

  await campoPersonalizadoModel.remover(req.params.id, req.usuario.id);
  res.status(204).send();
}

async function listarValoresDoLead(req, res) {
  const lead = await leadModel.buscarPorId(req.params.leadId, req.usuario.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  const valores = await campoPersonalizadoModel.listarValoresPorLead(req.params.leadId, req.usuario.id);
  res.json(valores);
}

function validarValor(campo, valor) {
  if (campo.tipo === 'texto') {
    return validators.dentroDoTamanho(valor, 500) ? null : 'valor deve ter no máximo 500 caracteres';
  }
  if (campo.tipo === 'numero') {
    return validators.numeroValido(valor) ? null : 'valor deve ser um número';
  }
  if (campo.tipo === 'data') {
    return validators.dataValida(valor) ? null : 'valor deve ser uma data válida';
  }
  if (campo.tipo === 'selecao') {
    return campo.opcoes.includes(valor) ? null : `valor deve ser um de: ${campo.opcoes.join(', ')}`;
  }
  return null;
}

async function definirValorDoLead(req, res) {
  const lead = await leadModel.buscarPorId(req.params.leadId, req.usuario.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  const campo = await campoPersonalizadoModel.buscarPorId(req.params.campoId, req.usuario.id);
  if (!campo) return res.status(404).json({ error: 'Campo não encontrado' });

  const { valor } = req.body;
  if (valor === undefined || valor === null || valor === '') {
    await campoPersonalizadoModel.removerValor(req.params.leadId, req.params.campoId);
    return res.status(200).json({ ok: true });
  }

  const erro = validarValor(campo, valor);
  if (erro) return res.status(400).json({ error: erro });

  await campoPersonalizadoModel.definirValor(req.params.leadId, req.params.campoId, valor);
  res.status(200).json({ ok: true });
}

async function removerValorDoLead(req, res) {
  const lead = await leadModel.buscarPorId(req.params.leadId, req.usuario.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  await campoPersonalizadoModel.removerValor(req.params.leadId, req.params.campoId);
  res.status(204).send();
}

module.exports = {
  listar: asyncHandler(listar),
  criar: asyncHandler(criar),
  atualizar: asyncHandler(atualizar),
  remover: asyncHandler(remover),
  listarValoresDoLead: asyncHandler(listarValoresDoLead),
  definirValorDoLead: asyncHandler(definirValorDoLead),
  removerValorDoLead: asyncHandler(removerValorDoLead),
};
