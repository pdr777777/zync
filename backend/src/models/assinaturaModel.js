const db = require('../config/db');

async function criar({ usuarioId, planoId, valor, syncpayIdentifier, pixCode }) {
  const { rows } = await db.query(
    'INSERT INTO assinaturas (usuario_id, plano_id, valor, syncpay_identifier, pix_code) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [usuarioId, planoId, valor, syncpayIdentifier, pixCode]
  );
  return buscarPorId(rows[0].id);
}

async function buscarPorId(id) {
  const { rows } = await db.query('SELECT * FROM assinaturas WHERE id = $1', [id]);
  return rows[0];
}

async function buscarPorIdentifier(identifier) {
  const { rows } = await db.query('SELECT * FROM assinaturas WHERE syncpay_identifier = $1', [identifier]);
  return rows[0];
}

async function buscarAtualPorUsuario(usuarioId) {
  const { rows } = await db.query(
    `SELECT a.*, p.nome AS plano_nome, p.limite_leads_mes, p.limite_mensagens_mes FROM assinaturas a
     JOIN planos p ON p.id = a.plano_id
     WHERE a.usuario_id = $1
     ORDER BY a.criado_em DESC, a.id DESC
     LIMIT 1`,
    [usuarioId]
  );
  return rows[0];
}

async function marcarAtiva(identifier, intervaloDias) {
  await db.query(
    `UPDATE assinaturas
     SET status = 'ativa', expira_em = NOW() + ($1 * INTERVAL '1 day')
     WHERE syncpay_identifier = $2`,
    [intervaloDias, identifier]
  );
}

async function marcarFalha(identifier) {
  await db.query(
    "UPDATE assinaturas SET status = 'cancelada' WHERE syncpay_identifier = $1",
    [identifier]
  );
}

async function listarPorUsuario(usuarioId) {
  const { rows } = await db.query(
    `SELECT a.*, p.nome AS plano_nome FROM assinaturas a
     JOIN planos p ON p.id = a.plano_id
     WHERE a.usuario_id = $1
     ORDER BY a.criado_em DESC, a.id DESC`,
    [usuarioId]
  );
  return rows;
}

async function cancelar(id, usuarioId) {
  await db.query(
    "UPDATE assinaturas SET status = 'cancelada' WHERE id = $1 AND usuario_id = $2 AND status = 'ativa'",
    [id, usuarioId]
  );
}

async function listarAtivasExpiradas() {
  const { rows } = await db.query(
    `SELECT a.id, a.usuario_id, u.email AS usuario_email, u.nome AS usuario_nome, p.nome AS plano_nome
     FROM assinaturas a
     JOIN usuarios u ON u.id = a.usuario_id
     JOIN planos p ON p.id = a.plano_id
     WHERE a.status = 'ativa' AND a.expira_em < NOW()`
  );
  return rows;
}

async function marcarExpirada(id) {
  await db.query("UPDATE assinaturas SET status = 'expirada' WHERE id = $1 AND status = 'ativa'", [id]);
}

module.exports = {
  criar,
  buscarPorId,
  buscarPorIdentifier,
  buscarAtualPorUsuario,
  marcarAtiva,
  marcarFalha,
  listarPorUsuario,
  cancelar,
  listarAtivasExpiradas,
  marcarExpirada,
};
