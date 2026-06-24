const db = require('../config/db');

async function listarPorLead(leadId, { page, limit } = {}) {
  if (page === undefined && limit === undefined) {
    const { rows } = await db.query(
      'SELECT * FROM mensagens WHERE lead_id = $1 ORDER BY criado_em ASC, id ASC',
      [leadId]
    );
    return rows;
  }

  const paginaNum = Math.max(1, parseInt(page, 10) || 1);
  const limiteNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (paginaNum - 1) * limiteNum;

  const { rows } = await db.query(
    'SELECT * FROM mensagens WHERE lead_id = $1 ORDER BY criado_em ASC, id ASC LIMIT $2 OFFSET $3',
    [leadId, limiteNum, offset]
  );

  const { rows: totalRows } = await db.query(
    'SELECT COUNT(*)::int AS total FROM mensagens WHERE lead_id = $1',
    [leadId]
  );
  const total = totalRows[0].total;

  return {
    dados: rows,
    pagina: paginaNum,
    limite: limiteNum,
    total,
    totalPaginas: Math.ceil(total / limiteNum),
  };
}

async function criar({ leadId, conteudo, enviadoPor }) {
  const { rows } = await db.query(
    'INSERT INTO mensagens (lead_id, conteudo, enviado_por) VALUES ($1, $2, $3) RETURNING *',
    [leadId, conteudo, enviadoPor]
  );
  return rows[0];
}

module.exports = { listarPorLead, criar };
