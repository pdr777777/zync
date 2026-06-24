const db = require('../config/db');

async function leadsPorOrigem(usuarioId) {
  const { rows } = await db.query(
    `SELECT COALESCE(origem, 'Não informado') AS origem, COUNT(*)::int AS total
     FROM leads
     WHERE usuario_id = $1
     GROUP BY origem
     ORDER BY total DESC`,
    [usuarioId]
  );
  return rows;
}

async function funilConversao(usuarioId) {
  const { rows } = await db.query(
    'SELECT status, COUNT(*)::int AS total FROM leads WHERE usuario_id = $1 GROUP BY status',
    [usuarioId]
  );

  const porStatus = {};
  let totalGeral = 0;
  for (const row of rows) {
    porStatus[row.status] = row.total;
    totalGeral += row.total;
  }

  const fechados = porStatus.fechado || 0;
  const taxaConversao = totalGeral ? Math.round((fechados / totalGeral) * 100) : 0;

  return { porStatus, totalGeral, taxaConversao };
}

async function faturamentoPorPeriodo(usuarioId, { inicio, fim, agrupamento } = {}) {
  const formato = agrupamento === 'mes' ? 'YYYY-MM' : 'YYYY-MM-DD';

  const condicoes = ['usuario_id = $1', "status = 'fechado'", 'fechado_em IS NOT NULL'];
  const params = [usuarioId];

  if (inicio) {
    params.push(inicio);
    condicoes.push(`fechado_em >= $${params.length}`);
  }

  if (fim) {
    params.push(fim);
    condicoes.push(`fechado_em <= $${params.length}`);
  }

  params.push(formato);
  const formatoIndex = params.length;

  const { rows } = await db.query(
    `SELECT TO_CHAR(fechado_em, $${formatoIndex}) AS periodo, SUM(valor) AS total, COUNT(*)::int AS quantidade
     FROM leads
     WHERE ${condicoes.join(' AND ')}
     GROUP BY periodo
     ORDER BY periodo ASC`,
    params
  );

  return rows;
}

module.exports = { leadsPorOrigem, funilConversao, faturamentoPorPeriodo };
