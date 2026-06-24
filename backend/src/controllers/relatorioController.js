const relatorioModel = require('../models/relatorioModel');
const asyncHandler = require('../utils/asyncHandler');
const validators = require('../utils/validators');

async function porOrigem(req, res) {
  const dados = await relatorioModel.leadsPorOrigem(req.usuario.id);
  res.json(dados);
}

async function funil(req, res) {
  const dados = await relatorioModel.funilConversao(req.usuario.id);
  res.json(dados);
}

async function faturamento(req, res) {
  const { inicio, fim, agrupamento } = req.query;

  if (inicio !== undefined && !validators.dataValida(inicio)) {
    return res.status(400).json({ error: 'inicio inválido' });
  }

  if (fim !== undefined && !validators.dataValida(fim)) {
    return res.status(400).json({ error: 'fim inválido' });
  }

  if (agrupamento !== undefined && !['dia', 'mes'].includes(agrupamento)) {
    return res.status(400).json({ error: "agrupamento deve ser 'dia' ou 'mes'" });
  }

  const dados = await relatorioModel.faturamentoPorPeriodo(req.usuario.id, { inicio, fim, agrupamento });
  res.json(dados);
}

module.exports = {
  porOrigem: asyncHandler(porOrigem),
  funil: asyncHandler(funil),
  faturamento: asyncHandler(faturamento),
};
