const npsModel = require('../models/npsModel');
const usuarioModel = require('../models/usuarioModel');
const asyncHandler = require('../utils/asyncHandler');
const validators = require('../utils/validators');

const DIAS_MINIMOS_DE_CONTA = 30;

async function elegivel(req, res) {
  const usuario = await usuarioModel.buscarPorId(req.usuario.id);

  const diasDeConta = (Date.now() - new Date(usuario.criado_em).getTime()) / (1000 * 60 * 60 * 24);
  if (diasDeConta < DIAS_MINIMOS_DE_CONTA || usuario.nps_dispensado_em) {
    return res.json({ elegivel: false });
  }

  const ultimaResposta = await npsModel.buscarUltimaResposta(req.usuario.id);
  res.json({ elegivel: !ultimaResposta });
}

async function criar(req, res) {
  const { nota, comentario } = req.body;

  if (!Number.isInteger(nota) || nota < 0 || nota > 10) {
    return res.status(400).json({ error: 'nota deve ser um número inteiro entre 0 e 10' });
  }

  if (comentario !== undefined && !validators.dentroDoTamanho(comentario, 500)) {
    return res.status(400).json({ error: 'comentario deve ter no máximo 500 caracteres' });
  }

  const resposta = await npsModel.criar({ usuarioId: req.usuario.id, nota, comentario });
  res.status(201).json(resposta);
}

async function dispensar(req, res) {
  await usuarioModel.marcarNpsDispensado(req.usuario.id);
  res.status(204).send();
}

module.exports = {
  elegivel: asyncHandler(elegivel),
  criar: asyncHandler(criar),
  dispensar: asyncHandler(dispensar),
};
