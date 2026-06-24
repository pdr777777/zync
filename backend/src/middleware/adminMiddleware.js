const usuarioModel = require('../models/usuarioModel');
const asyncHandler = require('../utils/asyncHandler');

async function exigirAdmin(req, res, next) {
  const usuario = await usuarioModel.buscarPorId(req.usuario.id);

  if (!usuario || !usuario.is_admin) {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }

  next();
}

module.exports = asyncHandler(exigirAdmin);
