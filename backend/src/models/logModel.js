const db = require('../config/db');

async function registrar({ usuarioId, leadId, acao, detalhes }) {
  await db.query(
    'INSERT INTO logs_atividade (usuario_id, lead_id, acao, detalhes) VALUES ($1, $2, $3, $4)',
    [usuarioId, leadId || null, acao, detalhes ? JSON.stringify(detalhes) : null]
  );
}

async function listarPorUsuario(usuarioId, { leadId, limit } = {}) {
  const limiteNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

  const condicoes = ['usuario_id = $1'];
  const params = [usuarioId];

  if (leadId) {
    params.push(leadId);
    condicoes.push(`lead_id = $${params.length}`);
  }

  params.push(limiteNum);
  const { rows } = await db.query(
    `SELECT * FROM logs_atividade WHERE ${condicoes.join(' AND ')} ORDER BY criado_em DESC, id DESC LIMIT $${params.length}`,
    params
  );

  return rows;
}

module.exports = { registrar, listarPorUsuario };
