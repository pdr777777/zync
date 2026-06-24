const db = require('../config/db');

async function leadsPorOrigem(usuarioId) {
  const [rows] = await db.query(
    `SELECT COALESCE(origem, 'Não informado') AS origem, COUNT(*) AS total
     FROM leads
     WHERE usuario_id = ?
     GROUP BY origem
     ORDER BY total DESC`,
    [usuarioId]
  );
  return rows;
}

async function funilConversao(usuarioId) {
  const [rows] = await db.query(
    'SELECT status, COUNT(*) AS total FROM leads WHERE usuario_id = ? GROUP BY status',
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
  const formato = agrupamento === 'mes' ? '%Y-%m' : '%Y-%m-%d';

  const condicoes = ['usuario_id = ?', "status = 'fechado'", 'fechado_em IS NOT NULL'];
  const params = [usuarioId];

  if (inicio) {
    condicoes.push('fechado_em >= ?');
    params.push(inicio);
  }

  if (fim) {
    condicoes.push('fechado_em <= ?');
    params.push(fim);
  }

  const [rows] = await db.query(
    `SELECT DATE_FORMAT(fechado_em, ?) AS periodo, SUM(valor) AS total, COUNT(*) AS quantidade
     FROM leads
     WHERE ${condicoes.join(' AND ')}
     GROUP BY periodo
     ORDER BY periodo ASC`,
    [formato, ...params]
  );

  return rows;
}

module.exports = { leadsPorOrigem, funilConversao, faturamentoPorPeriodo };
