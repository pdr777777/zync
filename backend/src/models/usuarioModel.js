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
  const [rows] = await db.query(
    'SELECT id, nome, email, criado_em, is_admin FROM usuarios WHERE id = ?',
    [id]
  );
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

async function definirTokenReset(id, tokenHash, expiraEm) {
  await db.query(
    'UPDATE usuarios SET reset_token_hash = ?, reset_token_expira = ? WHERE id = ?',
    [tokenHash, expiraEm, id]
  );
}

async function buscarPorTokenResetValido(tokenHash) {
  const [rows] = await db.query(
    'SELECT * FROM usuarios WHERE reset_token_hash = ? AND reset_token_expira > NOW()',
    [tokenHash]
  );
  return rows[0];
}

async function limparTokenReset(id) {
  await db.query(
    'UPDATE usuarios SET reset_token_hash = NULL, reset_token_expira = NULL WHERE id = ?',
    [id]
  );
}

async function definirAdmin(id, isAdmin) {
  await db.query('UPDATE usuarios SET is_admin = ? WHERE id = ?', [isAdmin ? 1 : 0, id]);
}

module.exports = {
  findByEmail,
  create,
  buscarPorId,
  buscarPorIdComSenha,
  atualizar,
  definirTokenReset,
  buscarPorTokenResetValido,
  limparTokenReset,
  definirAdmin,
};
