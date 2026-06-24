const db = require('../config/db');

async function leadsHoje(usuarioId) {
  const [rows] = await db.query(
    'SELECT COUNT(*) AS total FROM leads WHERE usuario_id = ? AND DATE(criado_em) = CURDATE()',
    [usuarioId]
  );
  return rows[0].total;
}

async function totalConversoes(usuarioId) {
  const [rows] = await db.query(
    "SELECT COUNT(*) AS total FROM leads WHERE usuario_id = ? AND status = 'fechado'",
    [usuarioId]
  );
  return rows[0].total;
}

async function mensagensEnviadas(usuarioId) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total FROM mensagens m
     INNER JOIN leads l ON l.id = m.lead_id
     WHERE l.usuario_id = ?`,
    [usuarioId]
  );
  return rows[0].total;
}

async function taxaRespostaIA(usuarioId) {
  const [rows] = await db.query(
    `SELECT
       SUM(CASE WHEN m.enviado_por = 'ia' THEN 1 ELSE 0 END) AS ia,
       COUNT(*) AS total
     FROM mensagens m
     INNER JOIN leads l ON l.id = m.lead_id
     WHERE l.usuario_id = ?`,
    [usuarioId]
  );
  const { ia, total } = rows[0];
  if (!total) return 0;
  return Math.round((ia / total) * 100);
}

async function leadsPorStatus(usuarioId) {
  const [rows] = await db.query(
    'SELECT status, COUNT(*) AS total FROM leads WHERE usuario_id = ? GROUP BY status',
    [usuarioId]
  );
  return rows;
}

module.exports = { leadsHoje, totalConversoes, mensagensEnviadas, taxaRespostaIA, leadsPorStatus };
