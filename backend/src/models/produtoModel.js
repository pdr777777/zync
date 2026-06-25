const db = require('../config/db');

async function listarPorUsuario(usuarioId) {
  const { rows } = await db.query(
    'SELECT * FROM produtos WHERE usuario_id = $1 ORDER BY criado_em DESC, id DESC',
    [usuarioId]
  );
  return rows;
}

async function buscarPorId(id, usuarioId) {
  const { rows } = await db.query('SELECT * FROM produtos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rows[0];
}

async function criar({ usuarioId, nome, descricao, preco, fotoUrl }) {
  const { rows } = await db.query(
    'INSERT INTO produtos (usuario_id, nome, descricao, preco, foto_url) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [usuarioId, nome, descricao || null, preco, fotoUrl || null]
  );
  return buscarPorId(rows[0].id, usuarioId);
}

async function atualizar(id, usuarioId, { nome, descricao, preco, fotoUrl, ativo }) {
  const campos = [];
  const valores = [];
  let i = 1;

  if (nome !== undefined) { campos.push(`nome = $${i++}`); valores.push(nome); }
  if (descricao !== undefined) { campos.push(`descricao = $${i++}`); valores.push(descricao); }
  if (preco !== undefined) { campos.push(`preco = $${i++}`); valores.push(preco); }
  if (fotoUrl !== undefined) { campos.push(`foto_url = $${i++}`); valores.push(fotoUrl); }
  if (ativo !== undefined) { campos.push(`ativo = $${i++}`); valores.push(ativo); }

  if (campos.length === 0) return buscarPorId(id, usuarioId);

  valores.push(id, usuarioId);
  await db.query(
    `UPDATE produtos SET ${campos.join(', ')} WHERE id = $${i++} AND usuario_id = $${i}`,
    valores
  );
  return buscarPorId(id, usuarioId);
}

async function remover(id, usuarioId) {
  await db.query('DELETE FROM produtos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
}

async function listarAtivosPorUsuarioId(usuarioId) {
  const { rows } = await db.query(
    'SELECT id, nome, descricao, preco, foto_url FROM produtos WHERE usuario_id = $1 AND ativo = true ORDER BY criado_em DESC, id DESC',
    [usuarioId]
  );
  return rows;
}

module.exports = {
  listarPorUsuario,
  buscarPorId,
  criar,
  atualizar,
  remover,
  listarAtivosPorUsuarioId,
};
