const db = require('../config/db');

async function criar({ usuarioId, planoId, valor, syncpayIdentifier, pixCode }) {
  const [result] = await db.query(
    'INSERT INTO assinaturas (usuario_id, plano_id, valor, syncpay_identifier, pix_code) VALUES (?, ?, ?, ?, ?)',
    [usuarioId, planoId, valor, syncpayIdentifier, pixCode]
  );
  return buscarPorId(result.insertId);
}

async function buscarPorId(id) {
  const [rows] = await db.query('SELECT * FROM assinaturas WHERE id = ?', [id]);
  return rows[0];
}

async function buscarPorIdentifier(identifier) {
  const [rows] = await db.query('SELECT * FROM assinaturas WHERE syncpay_identifier = ?', [identifier]);
  return rows[0];
}

async function buscarAtualPorUsuario(usuarioId) {
  const [rows] = await db.query(
    `SELECT a.*, p.nome AS plano_nome FROM assinaturas a
     JOIN planos p ON p.id = a.plano_id
     WHERE a.usuario_id = ?
     ORDER BY a.criado_em DESC, a.id DESC
     LIMIT 1`,
    [usuarioId]
  );
  return rows[0];
}

async function marcarAtiva(identifier, intervaloDias) {
  await db.query(
    `UPDATE assinaturas
     SET status = 'ativa', expira_em = DATE_ADD(NOW(), INTERVAL ? DAY)
     WHERE syncpay_identifier = ?`,
    [intervaloDias, identifier]
  );
}

async function marcarFalha(identifier) {
  await db.query(
    "UPDATE assinaturas SET status = 'cancelada' WHERE syncpay_identifier = ?",
    [identifier]
  );
}

async function listarPorUsuario(usuarioId) {
  const [rows] = await db.query(
    `SELECT a.*, p.nome AS plano_nome FROM assinaturas a
     JOIN planos p ON p.id = a.plano_id
     WHERE a.usuario_id = ?
     ORDER BY a.criado_em DESC, a.id DESC`,
    [usuarioId]
  );
  return rows;
}

async function cancelar(id, usuarioId) {
  await db.query(
    "UPDATE assinaturas SET status = 'cancelada' WHERE id = ? AND usuario_id = ? AND status = 'ativa'",
    [id, usuarioId]
  );
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
};
