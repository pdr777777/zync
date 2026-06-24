const db = require('../config/db');

async function leadsHoje(usuarioId) {
  const { rows } = await db.query(
    'SELECT COUNT(*)::int AS total FROM leads WHERE usuario_id = $1 AND criado_em::date = CURRENT_DATE',
    [usuarioId]
  );
  return rows[0].total;
}

async function totalConversoes(usuarioId) {
  const { rows } = await db.query(
    "SELECT COUNT(*)::int AS total FROM leads WHERE usuario_id = $1 AND status = 'fechado'",
    [usuarioId]
  );
  return rows[0].total;
}

async function mensagensEnviadas(usuarioId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM mensagens m
     INNER JOIN leads l ON l.id = m.lead_id
     WHERE l.usuario_id = $1`,
    [usuarioId]
  );
  return rows[0].total;
}

async function taxaRespostaIA(usuarioId) {
  const { rows } = await db.query(
    `SELECT
       SUM(CASE WHEN m.enviado_por = 'ia' THEN 1 ELSE 0 END)::int AS ia,
       COUNT(*)::int AS total
     FROM mensagens m
     INNER JOIN leads l ON l.id = m.lead_id
     WHERE l.usuario_id = $1`,
    [usuarioId]
  );
  const { ia, total } = rows[0];
  if (!total) return 0;
  return Math.round((ia / total) * 100);
}

async function leadsPorStatus(usuarioId) {
  const { rows } = await db.query(
    'SELECT status, COUNT(*)::int AS total FROM leads WHERE usuario_id = $1 GROUP BY status',
    [usuarioId]
  );
  return rows;
}

module.exports = { leadsHoje, totalConversoes, mensagensEnviadas, taxaRespostaIA, leadsPorStatus };
