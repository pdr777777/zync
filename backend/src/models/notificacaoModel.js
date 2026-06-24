const db = require('../config/db');

async function criar({ usuarioId, leadId, tipo, mensagem }) {
  await db.query(
    'INSERT INTO notificacoes (usuario_id, lead_id, tipo, mensagem) VALUES ($1, $2, $3, $4)',
    [usuarioId, leadId || null, tipo, mensagem]
  );
}

async function listarPorUsuario(usuarioId, { lida, limit } = {}) {
  const limiteNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));

  const condicoes = ['usuario_id = $1'];
  const params = [usuarioId];

  if (lida !== undefined) {
    params.push(lida === 'true' || lida === true);
    condicoes.push(`lida = $${params.length}`);
  }

  params.push(limiteNum);
  const { rows } = await db.query(
    `SELECT * FROM notificacoes WHERE ${condicoes.join(' AND ')} ORDER BY criado_em DESC, id DESC LIMIT $${params.length}`,
    params
  );

  return rows;
}

async function buscarPorId(id, usuarioId) {
  const { rows } = await db.query(
    'SELECT * FROM notificacoes WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId]
  );
  return rows[0];
}

async function contarNaoLidas(usuarioId) {
  const { rows } = await db.query(
    'SELECT COUNT(*)::int AS total FROM notificacoes WHERE usuario_id = $1 AND lida = false',
    [usuarioId]
  );
  return rows[0].total;
}

async function marcarComoLida(id, usuarioId) {
  await db.query(
    'UPDATE notificacoes SET lida = true WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId]
  );
}

async function marcarTodasComoLidas(usuarioId) {
  await db.query(
    'UPDATE notificacoes SET lida = true WHERE usuario_id = $1 AND lida = false',
    [usuarioId]
  );
}

module.exports = { criar, listarPorUsuario, buscarPorId, contarNaoLidas, marcarComoLida, marcarTodasComoLidas };
