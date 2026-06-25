const db = require('../config/db');

async function contarLeadsDoMes(usuarioId) {
  const { rows } = await db.query(
    "SELECT COUNT(*) FROM leads WHERE usuario_id = $1 AND criado_em >= date_trunc('month', NOW())",
    [usuarioId]
  );
  return parseInt(rows[0].count, 10);
}

async function contarMensagensDoMes(usuarioId) {
  const { rows } = await db.query(
    `SELECT COUNT(*) FROM mensagens m
     JOIN leads l ON l.id = m.lead_id
     WHERE l.usuario_id = $1 AND m.criado_em >= date_trunc('month', NOW())`,
    [usuarioId]
  );
  return parseInt(rows[0].count, 10);
}

module.exports = { contarLeadsDoMes, contarMensagensDoMes };
