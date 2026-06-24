const db = require('../config/db');

async function findByEmail(email) {
  const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
  return rows[0];
}

async function create({ nome, email, senha_hash }) {
  const { rows } = await db.query(
    'INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id',
    [nome, email, senha_hash]
  );
  return { id: rows[0].id, nome, email };
}

async function buscarPorId(id) {
  const { rows } = await db.query(
    'SELECT id, nome, email, criado_em, is_admin FROM usuarios WHERE id = $1',
    [id]
  );
  return rows[0];
}

async function buscarPorIdComSenha(id) {
  const { rows } = await db.query('SELECT * FROM usuarios WHERE id = $1', [id]);
  return rows[0];
}

async function atualizar(id, dados) {
  const campos = [];
  const valores = [];
  let i = 1;

  for (const campo of ['nome', 'email', 'senha_hash']) {
    if (dados[campo] !== undefined) {
      campos.push(`${campo} = $${i++}`);
      valores.push(dados[campo]);
    }
  }

  if (dados.senha_hash !== undefined) {
    campos.push('senha_alterada_em = NOW()');
  }

  if (campos.length === 0) return buscarPorId(id);

  await db.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = $${i}`, [...valores, id]);

  return buscarPorId(id);
}

async function buscarTimestampSenha(id) {
  const { rows } = await db.query('SELECT senha_alterada_em FROM usuarios WHERE id = $1', [id]);
  return rows[0]?.senha_alterada_em;
}

async function invalidarSessoes(id) {
  await db.query('UPDATE usuarios SET senha_alterada_em = NOW() WHERE id = $1', [id]);
}

async function definirTokenReset(id, tokenHash, expiraEm) {
  await db.query(
    'UPDATE usuarios SET reset_token_hash = $1, reset_token_expira = $2 WHERE id = $3',
    [tokenHash, expiraEm, id]
  );
}

async function buscarPorTokenResetValido(tokenHash) {
  const { rows } = await db.query(
    'SELECT * FROM usuarios WHERE reset_token_hash = $1 AND reset_token_expira > NOW()',
    [tokenHash]
  );
  return rows[0];
}

async function limparTokenReset(id) {
  await db.query(
    'UPDATE usuarios SET reset_token_hash = NULL, reset_token_expira = NULL WHERE id = $1',
    [id]
  );
}

async function definirAdmin(id, isAdmin) {
  await db.query('UPDATE usuarios SET is_admin = $1 WHERE id = $2', [!!isAdmin, id]);
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
  buscarTimestampSenha,
  invalidarSessoes,
};
