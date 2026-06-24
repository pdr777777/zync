const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const usuarioModel = require('../models/usuarioModel');
const emailService = require('../services/emailService');
const asyncHandler = require('../utils/asyncHandler');
const validators = require('../utils/validators');

async function register(req, res) {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'nome, email e senha são obrigatórios' });
  }

  if (!validators.emailValido(email)) {
    return res.status(400).json({ error: 'email inválido' });
  }

  if (!validators.senhaValida(senha)) {
    return res.status(400).json({ error: 'senha deve ter pelo menos 6 caracteres' });
  }

  const existente = await usuarioModel.findByEmail(email);
  if (existente) {
    return res.status(409).json({ error: 'E-mail já cadastrado' });
  }

  const senha_hash = await bcrypt.hash(senha, 10);
  const usuario = await usuarioModel.create({ nome, email, senha_hash });

  res.status(201).json(usuario);
}

async function login(req, res) {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ error: 'email e senha são obrigatórios' });
  }

  const usuario = await usuarioModel.findByEmail(email);
  if (!usuario) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaValida) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      pwdTs: Math.floor(new Date(usuario.senha_alterada_em).getTime() / 1000),
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, is_admin: !!usuario.is_admin },
  });
}

async function me(req, res) {
  const usuario = await usuarioModel.buscarPorId(req.usuario.id);
  if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json(usuario);
}

async function atualizarMe(req, res) {
  const { nome, email, senha, senha_atual } = req.body;
  const dados = {};

  if (nome !== undefined) {
    if (!nome) return res.status(400).json({ error: 'nome não pode ser vazio' });
    dados.nome = nome;
  }

  if (email !== undefined) {
    if (!validators.emailValido(email)) {
      return res.status(400).json({ error: 'email inválido' });
    }

    const existente = await usuarioModel.findByEmail(email);
    if (existente && existente.id !== req.usuario.id) {
      return res.status(409).json({ error: 'E-mail já cadastrado' });
    }

    dados.email = email;
  }

  if (senha !== undefined) {
    if (!senha_atual) {
      return res.status(400).json({ error: 'senha_atual é obrigatória para trocar a senha' });
    }

    const usuarioAtual = await usuarioModel.buscarPorIdComSenha(req.usuario.id);
    const senhaCorreta = await bcrypt.compare(senha_atual, usuarioAtual.senha_hash);
    if (!senhaCorreta) {
      return res.status(401).json({ error: 'senha_atual incorreta' });
    }

    if (!validators.senhaValida(senha)) {
      return res.status(400).json({ error: 'senha deve ter pelo menos 6 caracteres' });
    }

    dados.senha_hash = await bcrypt.hash(senha, 10);
  }

  const usuario = await usuarioModel.atualizar(req.usuario.id, dados);
  res.json(usuario);
}

async function esqueciSenha(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email é obrigatório' });

  const usuario = await usuarioModel.findByEmail(email);

  if (usuario) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiraEm = new Date(Date.now() + 60 * 60 * 1000);

    await usuarioModel.definirTokenReset(usuario.id, tokenHash, expiraEm);

    const linkReset = `${process.env.FRONTEND_URL || ''}/pages/redefinir-senha.html?token=${token}`;
    emailService.enviarEmail(
      usuario.email,
      'Redefinição de senha - Zync',
      `Clique no link para redefinir sua senha (válido por 1 hora): ${linkReset}`
    );
  }

  res.json({ mensagem: 'Se o e-mail existir, enviamos instruções de redefinição de senha.' });
}

async function logoutEverywhere(req, res) {
  await usuarioModel.invalidarSessoes(req.usuario.id);
  res.json({ mensagem: 'Todas as sessões foram encerradas. Faça login novamente.' });
}

async function redefinirSenha(req, res) {
  const { token, novaSenha } = req.body;
  if (!token || !novaSenha) {
    return res.status(400).json({ error: 'token e novaSenha são obrigatórios' });
  }

  if (!validators.senhaValida(novaSenha)) {
    return res.status(400).json({ error: 'senha deve ter pelo menos 6 caracteres' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const usuario = await usuarioModel.buscarPorTokenResetValido(tokenHash);

  if (!usuario) {
    return res.status(400).json({ error: 'Token inválido ou expirado' });
  }

  const senha_hash = await bcrypt.hash(novaSenha, 10);
  await usuarioModel.atualizar(usuario.id, { senha_hash });
  await usuarioModel.limparTokenReset(usuario.id);

  res.json({ mensagem: 'Senha redefinida com sucesso' });
}

module.exports = {
  register: asyncHandler(register),
  login: asyncHandler(login),
  me: asyncHandler(me),
  atualizarMe: asyncHandler(atualizarMe),
  logoutEverywhere: asyncHandler(logoutEverywhere),
  esqueciSenha: asyncHandler(esqueciSenha),
  redefinirSenha: asyncHandler(redefinirSenha),
};
