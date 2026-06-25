const suporteModel = require('../models/suporteModel');
const asyncHandler = require('../utils/asyncHandler');
const validators = require('../utils/validators');

async function criar(req, res) {
  const { mensagem, videoUrl } = req.body;
  if (!mensagem) return res.status(400).json({ error: 'mensagem é obrigatória' });
  if (!validators.dentroDoTamanho(mensagem, 2000)) return res.status(400).json({ error: 'mensagem deve ter no máximo 2000 caracteres' });
  if (!validators.dentroDoTamanho(videoUrl, 500)) return res.status(400).json({ error: 'videoUrl deve ter no máximo 500 caracteres' });

  const item = await suporteModel.criar({ usuarioId: req.usuario.id, mensagem, videoUrl });
  res.status(201).json(item);
}

async function listar(req, res) {
  const itens = await suporteModel.listarPorUsuario(req.usuario.id);
  res.json(itens);
}

module.exports = {
  criar: asyncHandler(criar),
  listar: asyncHandler(listar),
};
