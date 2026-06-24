const db = require('../config/db');

const CAMPOS_ATUALIZAVEIS = ['servico', 'data_hora', 'status'];

async function listarPorUsuario(usuarioId) {
  const { rows } = await db.query(
    'SELECT * FROM agendamentos WHERE usuario_id = $1 ORDER BY data_hora ASC, id ASC',
    [usuarioId]
  );
  return rows;
}

async function listarPorLead(leadId, usuarioId) {
  const { rows } = await db.query(
    'SELECT * FROM agendamentos WHERE lead_id = $1 AND usuario_id = $2 ORDER BY data_hora ASC, id ASC',
    [leadId, usuarioId]
  );
  return rows;
}

async function buscarPorId(id, usuarioId) {
  const { rows } = await db.query(
    'SELECT * FROM agendamentos WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId]
  );
  return rows[0];
}

async function criar({ usuarioId, leadId, servico, data_hora }) {
  const { rows } = await db.query(
    'INSERT INTO agendamentos (usuario_id, lead_id, servico, data_hora) VALUES ($1, $2, $3, $4) RETURNING id',
    [usuarioId, leadId, servico || null, data_hora]
  );
  return buscarPorId(rows[0].id, usuarioId);
}

async function atualizar(id, usuarioId, dados) {
  const campos = [];
  const valores = [];
  let i = 1;

  for (const campo of CAMPOS_ATUALIZAVEIS) {
    if (dados[campo] !== undefined) {
      campos.push(`${campo} = $${i++}`);
      valores.push(dados[campo]);
    }
  }

  if (campos.length === 0) return buscarPorId(id, usuarioId);

  await db.query(
    `UPDATE agendamentos SET ${campos.join(', ')} WHERE id = $${i++} AND usuario_id = $${i}`,
    [...valores, id, usuarioId]
  );

  return buscarPorId(id, usuarioId);
}

async function remover(id, usuarioId) {
  await db.query('DELETE FROM agendamentos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
}

module.exports = { listarPorUsuario, listarPorLead, buscarPorId, criar, atualizar, remover };
