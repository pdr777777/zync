const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const usuarioModel = require('../models/usuarioModel');
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
    { id: usuario.id, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
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

module.exports = {
  register: asyncHandler(register),
  login: asyncHandler(login),
  me: asyncHandler(me),
  atualizarMe: asyncHandler(atualizarMe),
};
