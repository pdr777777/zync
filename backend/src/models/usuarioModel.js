const crypto = require('crypto');
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
    `SELECT id, nome, email, criado_em, is_admin,
            foto_url, idade, cpf, instagram, facebook, telefone, nome_empresa,
            whatsapp_phone_number_id
     FROM usuarios WHERE id = $1`,
    [id]
  );
  return rows[0];
}

async function buscarPorIdComSenha(id) {
  const { rows } = await db.query('SELECT * FROM usuarios WHERE id = $1', [id]);
  return rows[0];
}

const CAMPOS_ATUALIZAVEIS = [
  'nome', 'email', 'senha_hash',
  'foto_url', 'idade', 'cpf', 'instagram', 'facebook', 'telefone', 'nome_empresa',
  'whatsapp_phone_number_id',
];

async function atualizar(id, dados) {
  const campos = [];
  const valores = [];
  let i = 1;

  for (const campo of CAMPOS_ATUALIZAVEIS) {
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

async function garantirSlugCatalogo(id) {
  const { rows } = await db.query('SELECT catalogo_slug FROM usuarios WHERE id = $1', [id]);
  if (rows[0]?.catalogo_slug) return rows[0].catalogo_slug;

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const slug = crypto.randomBytes(12).toString('hex');
    try {
      await db.query('UPDATE usuarios SET catalogo_slug = $1 WHERE id = $2', [slug, id]);
      return slug;
    } catch (err) {
      if (err.code !== '23505' || tentativa === 2) throw err;
    }
  }
}

async function buscarPorSlugCatalogo(slug) {
  const { rows } = await db.query('SELECT id, nome FROM usuarios WHERE catalogo_slug = $1', [slug]);
  return rows[0];
}

async function buscarPorWhatsappPhoneNumberId(phoneNumberId) {
  const { rows } = await db.query(
    'SELECT id, nome FROM usuarios WHERE whatsapp_phone_number_id = $1',
    [phoneNumberId]
  );
  return rows[0];
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
  garantirSlugCatalogo,
  buscarPorSlugCatalogo,
  buscarPorWhatsappPhoneNumberId,
};
