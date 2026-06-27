const afiliadoModel = require('../models/afiliadoModel');
const comissaoAfiliadoModel = require('../models/comissaoAfiliadoModel');
const asyncHandler = require('../utils/asyncHandler');

async function meu(req, res) {
  const afiliado = await afiliadoModel.buscarPorUsuarioId(req.usuario.id);
  res.json(afiliado || null);
}

async function minhasComissoes(req, res) {
  const afiliado = await afiliadoModel.buscarPorUsuarioId(req.usuario.id);
  if (!afiliado) return res.json([]);

  const comissoes = await comissaoAfiliadoModel.listarPorAfiliado(afiliado.id);
  res.json(comissoes);
}

module.exports = {
  meu: asyncHandler(meu),
  minhasComissoes: asyncHandler(minhasComissoes),
};
