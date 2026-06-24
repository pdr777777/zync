const db = require('../config/db');

async function listarUsuarios() {
  const { rows } = await db.query(
    `SELECT u.id, u.nome, u.email, u.is_admin, u.criado_em,
            a.status AS assinatura_status, a.expira_em AS assinatura_expira_em, p.nome AS plano_nome
     FROM usuarios u
     LEFT JOIN assinaturas a ON a.id = (
       SELECT id FROM assinaturas WHERE usuario_id = u.id ORDER BY criado_em DESC, id DESC LIMIT 1
     )
     LEFT JOIN planos p ON p.id = a.plano_id
     ORDER BY u.criado_em DESC, u.id DESC`
  );
  return rows;
}

async function metricas() {
  const { rows: totalRows } = await db.query('SELECT COUNT(*)::int AS "totalUsuarios" FROM usuarios');
  const totalUsuarios = totalRows[0].totalUsuarios;

  const { rows: porStatus } = await db.query('SELECT status, COUNT(*)::int AS total FROM assinaturas GROUP BY status');

  const { rows: mrrRows } = await db.query(
    `SELECT COALESCE(SUM(a.valor / (p.intervalo_dias / 30.0)), 0) AS mrr
     FROM assinaturas a
     JOIN planos p ON p.id = a.plano_id
     WHERE a.status = 'ativa'`
  );
  const mrr = mrrRows[0].mrr;

  const assinaturasPorStatus = {};
  for (const row of porStatus) {
    assinaturasPorStatus[row.status] = row.total;
  }

  return { totalUsuarios, assinaturasPorStatus, mrr: Number(mrr) };
}

module.exports = { listarUsuarios, metricas };
