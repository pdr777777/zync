const db = require('../config/db');

const CAMPOS_ATUALIZAVEIS = ['servico', 'data_hora', 'status'];

async function listarPorUsuario(usuarioId) {
  const [rows] = await db.query(
    'SELECT * FROM agendamentos WHERE usuario_id = ? ORDER BY data_hora ASC',
    [usuarioId]
  );
  return rows;
}

async function listarPorLead(leadId, usuarioId) {
  const [rows] = await db.query(
    'SELECT * FROM agendamentos WHERE lead_id = ? AND usuario_id = ? ORDER BY data_hora ASC',
    [leadId, usuarioId]
  );
  return rows;
}

async function buscarPorId(id, usuarioId) {
  const [rows] = await db.query(
    'SELECT * FROM agendamentos WHERE id = ? AND usuario_id = ?',
    [id, usuarioId]
  );
  return rows[0];
}

async function criar({ usuarioId, leadId, servico, data_hora }) {
  const [result] = await db.query(
    'INSERT INTO agendamentos (usuario_id, lead_id, servico, data_hora) VALUES (?, ?, ?, ?)',
    [usuarioId, leadId, servico || null, data_hora]
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
    `UPDATE agendamentos SET ${campos.join(', ')} WHERE id = ? AND usuario_id = ?`,
    [...valores, id, usuarioId]
  );

  return buscarPorId(id, usuarioId);
}

async function remover(id, usuarioId) {
  await db.query('DELETE FROM agendamentos WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
}

module.exports = { listarPorUsuario, listarPorLead, buscarPorId, criar, atualizar, remover };
