const db = require('../config/db');

async function criar({ usuarioId, nota, comentario }) {
  const { rows } = await db.query(
    'INSERT INTO pesquisas_nps (usuario_id, nota, comentario) VALUES ($1, $2, $3) RETURNING *',
    [usuarioId, nota, comentario || null]
  );
  return rows[0];
}

async function buscarUltimaResposta(usuarioId) {
  const { rows } = await db.query(
    'SELECT * FROM pesquisas_nps WHERE usuario_id = $1 ORDER BY criado_em DESC LIMIT 1',
    [usuarioId]
  );
  return rows[0];
}

module.exports = { criar, buscarUltimaResposta };
