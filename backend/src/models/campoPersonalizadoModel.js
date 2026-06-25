const db = require('../config/db');

async function listarPorUsuario(usuarioId) {
  const { rows } = await db.query('SELECT * FROM campos_personalizados WHERE usuario_id = $1 ORDER BY nome', [usuarioId]);
  return rows;
}

async function buscarPorId(id, usuarioId) {
  const { rows } = await db.query('SELECT * FROM campos_personalizados WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rows[0];
}

async function criar({ usuarioId, nome, tipo, opcoes }) {
  const { rows } = await db.query(
    'INSERT INTO campos_personalizados (usuario_id, nome, tipo, opcoes) VALUES ($1, $2, $3, $4) RETURNING id',
    [usuarioId, nome, tipo, opcoes ? JSON.stringify(opcoes) : null]
  );
  return buscarPorId(rows[0].id, usuarioId);
}

async function atualizar(id, usuarioId, { nome, opcoes }) {
  const campos = [];
  const valores = [];
  let i = 1;

  if (nome !== undefined) { campos.push(`nome = $${i++}`); valores.push(nome); }
  if (opcoes !== undefined) { campos.push(`opcoes = $${i++}`); valores.push(JSON.stringify(opcoes)); }

  if (campos.length === 0) return buscarPorId(id, usuarioId);

  valores.push(id, usuarioId);
  await db.query(
    `UPDATE campos_personalizados SET ${campos.join(', ')} WHERE id = $${i++} AND usuario_id = $${i}`,
    valores
  );
  return buscarPorId(id, usuarioId);
}

async function remover(id, usuarioId) {
  await db.query('DELETE FROM campos_personalizados WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
}

async function listarValoresPorLead(leadId, usuarioId) {
  const { rows } = await db.query(
    `SELECT cp.id, cp.nome, cp.tipo, cp.opcoes, lcv.valor
     FROM campos_personalizados cp
     LEFT JOIN lead_campos_valores lcv ON lcv.campo_id = cp.id AND lcv.lead_id = $1
     WHERE cp.usuario_id = $2
     ORDER BY cp.nome`,
    [leadId, usuarioId]
  );
  return rows;
}

async function definirValor(leadId, campoId, valor) {
  await db.query(
    `INSERT INTO lead_campos_valores (lead_id, campo_id, valor) VALUES ($1, $2, $3)
     ON CONFLICT (lead_id, campo_id) DO UPDATE SET valor = $3`,
    [leadId, campoId, valor]
  );
}

async function removerValor(leadId, campoId) {
  await db.query('DELETE FROM lead_campos_valores WHERE lead_id = $1 AND campo_id = $2', [leadId, campoId]);
}

module.exports = {
  listarPorUsuario,
  buscarPorId,
  criar,
  atualizar,
  remover,
  listarValoresPorLead,
  definirValor,
  removerValor,
};
