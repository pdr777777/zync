const db = require('../config/db');

async function criar({ usuarioId, mensagem, videoUrl }) {
  const [result] = await db.query(
    'INSERT INTO mensagens_suporte (usuario_id, mensagem, video_url) VALUES (?, ?, ?)',
    [usuarioId, mensagem, videoUrl || null]
  );
  return buscarPorId(result.insertId);
}

async function buscarPorId(id) {
  const [rows] = await db.query('SELECT * FROM mensagens_suporte WHERE id = ?', [id]);
  return rows[0];
}

async function listarPorUsuario(usuarioId) {
  const [rows] = await db.query(
    'SELECT * FROM mensagens_suporte WHERE usuario_id = ? ORDER BY criado_em DESC, id DESC',
    [usuarioId]
  );
  return rows;
}

async function listarTodas() {
  const [rows] = await db.query(
    `SELECT m.*, u.nome AS usuario_nome, u.email AS usuario_email
     FROM mensagens_suporte m
     JOIN usuarios u ON u.id = m.usuario_id
     ORDER BY m.respondida ASC, m.criado_em DESC, m.id DESC`
  );
  return rows;
}

async function marcarRespondida(id) {
  await db.query('UPDATE mensagens_suporte SET respondida = 1 WHERE id = ?', [id]);
}

module.exports = { criar, buscarPorId, listarPorUsuario, listarTodas, marcarRespondida };
