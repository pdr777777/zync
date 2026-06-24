const db = require('../config/db');

async function listarPorUsuario(usuarioId) {
  const [rows] = await db.query('SELECT * FROM tags WHERE usuario_id = ? ORDER BY nome', [usuarioId]);
  return rows;
}

async function buscarPorId(id, usuarioId) {
  const [rows] = await db.query('SELECT * FROM tags WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
  return rows[0];
}

async function criar({ usuarioId, nome }) {
  const [result] = await db.query('INSERT INTO tags (usuario_id, nome) VALUES (?, ?)', [usuarioId, nome]);
  return buscarPorId(result.insertId, usuarioId);
}

async function remover(id, usuarioId) {
  await db.query('DELETE FROM tags WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
}

async function listarPorLead(leadId) {
  const [rows] = await db.query(
    `SELECT t.* FROM tags t
     INNER JOIN lead_tags lt ON lt.tag_id = t.id
     WHERE lt.lead_id = ?
     ORDER BY t.nome`,
    [leadId]
  );
  return rows;
}

async function associarLead(leadId, tagId) {
  await db.query('INSERT IGNORE INTO lead_tags (lead_id, tag_id) VALUES (?, ?)', [leadId, tagId]);
}

async function desassociarLead(leadId, tagId) {
  await db.query('DELETE FROM lead_tags WHERE lead_id = ? AND tag_id = ?', [leadId, tagId]);
}

module.exports = {
  listarPorUsuario,
  buscarPorId,
  criar,
  remover,
  listarPorLead,
  associarLead,
  desassociarLead,
};
