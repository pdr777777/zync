const db = require('../config/db');

async function listarPorUsuario(usuarioId) {
  const { rows } = await db.query('SELECT * FROM tags WHERE usuario_id = $1 ORDER BY nome', [usuarioId]);
  return rows;
}

async function buscarPorId(id, usuarioId) {
  const { rows } = await db.query('SELECT * FROM tags WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rows[0];
}

async function criar({ usuarioId, nome }) {
  const { rows } = await db.query('INSERT INTO tags (usuario_id, nome) VALUES ($1, $2) RETURNING id', [usuarioId, nome]);
  return buscarPorId(rows[0].id, usuarioId);
}

async function remover(id, usuarioId) {
  await db.query('DELETE FROM tags WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
}

async function listarPorLead(leadId) {
  const { rows } = await db.query(
    `SELECT t.* FROM tags t
     INNER JOIN lead_tags lt ON lt.tag_id = t.id
     WHERE lt.lead_id = $1
     ORDER BY t.nome`,
    [leadId]
  );
  return rows;
}

async function associarLead(leadId, tagId) {
  await db.query(
    'INSERT INTO lead_tags (lead_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [leadId, tagId]
  );
}

async function desassociarLead(leadId, tagId) {
  await db.query('DELETE FROM lead_tags WHERE lead_id = $1 AND tag_id = $2', [leadId, tagId]);
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
