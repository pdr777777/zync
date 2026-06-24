const db = require('../config/db');

const CAMPOS_ATUALIZAVEIS = ['nome', 'servico', 'origem', 'telefone', 'status', 'valor'];

async function listarPorUsuario(usuarioId) {
  const [rows] = await db.query(
    'SELECT * FROM leads WHERE usuario_id = ? ORDER BY criado_em DESC',
    [usuarioId]
  );
  return rows;
}

async function buscarPorId(id, usuarioId) {
  const [rows] = await db.query(
    'SELECT * FROM leads WHERE id = ? AND usuario_id = ?',
    [id, usuarioId]
  );
  return rows[0];
}

async function buscarPorTelefone(telefone, usuarioId) {
  const [rows] = await db.query(
    'SELECT * FROM leads WHERE telefone = ? AND usuario_id = ?',
    [telefone, usuarioId]
  );
  return rows[0];
}

async function criar({ usuarioId, nome, servico, origem, telefone, status, valor }) {
  const [result] = await db.query(
    'INSERT INTO leads (usuario_id, nome, servico, origem, telefone, status, valor) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [usuarioId, nome, servico || null, origem || null, telefone || null, status || 'novo', valor || null]
  );
  return buscarPorId(result.insertId, usuarioId);
}

async function atualizar(id, usuarioId, dados) {
  const campos = [];
  const valores = [];

  for (const campo of CAMPOS_ATUALIZAVEIS) {
    if (dados[campo] !== undefined) {
      campos.push(`${campo} = ?`);
      valores.push(dados[campo]);
    }
  }

  if (campos.length === 0) return buscarPorId(id, usuarioId);

  await db.query(
    `UPDATE leads SET ${campos.join(', ')} WHERE id = ? AND usuario_id = ?`,
    [...valores, id, usuarioId]
  );

  return buscarPorId(id, usuarioId);
}

async function remover(id, usuarioId) {
  await db.query('DELETE FROM leads WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
}

module.exports = { listarPorUsuario, buscarPorId, buscarPorTelefone, criar, atualizar, remover };
