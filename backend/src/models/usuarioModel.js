const db = require('../config/db');

async function findByEmail(email) {
  const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
  return rows[0];
}

async function create({ nome, email, senha_hash }) {
  const [result] = await db.query(
    'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)',
    [nome, email, senha_hash]
  );
  return { id: result.insertId, nome, email };
}

async function buscarPorId(id) {
  const [rows] = await db.query('SELECT id, nome, email, criado_em FROM usuarios WHERE id = ?', [id]);
  return rows[0];
}

async function buscarPorIdComSenha(id) {
  const [rows] = await db.query('SELECT * FROM usuarios WHERE id = ?', [id]);
  return rows[0];
}

async function atualizar(id, dados) {
  const campos = [];
  const valores = [];

  for (const campo of ['nome', 'email', 'senha_hash']) {
    if (dados[campo] !== undefined) {
      campos.push(`${campo} = ?`);
      valores.push(dados[campo]);
    }
  }

  if (campos.length === 0) return buscarPorId(id);

  await db.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, [...valores, id]);

  return buscarPorId(id);
}

module.exports = { findByEmail, create, buscarPorId, buscarPorIdComSenha, atualizar };
