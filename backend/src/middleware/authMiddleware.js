const jwt = require('jsonwebtoken');
const usuarioModel = require('../models/usuarioModel');
const asyncHandler = require('../utils/asyncHandler');

async function autenticar(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  const senhaAlteradaEm = await usuarioModel.buscarTimestampSenha(decoded.id);
  if (!senhaAlteradaEm) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  const pwdTsAtual = Math.floor(new Date(senhaAlteradaEm).getTime() / 1000);
  if (decoded.pwdTs !== pwdTsAtual) {
    return res.status(401).json({ error: 'Sessão expirada, faça login novamente' });
  }

  req.usuario = decoded;
  next();
}

module.exports = asyncHandler(autenticar);
