const db = require('../config/db');

async function listarAtivos() {
  const { rows } = await db.query('SELECT * FROM planos WHERE ativo = true ORDER BY preco ASC, id ASC');
  return rows;
}

async function listarTodos() {
  const { rows } = await db.query('SELECT * FROM planos ORDER BY ativo DESC, preco ASC, id ASC');
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await db.query('SELECT * FROM planos WHERE id = $1', [id]);
  return rows[0];
}

async function criar({ nome, preco, intervaloDias }) {
  const { rows } = await db.query(
    'INSERT INTO planos (nome, preco, intervalo_dias) VALUES ($1, $2, $3) RETURNING id',
    [nome, preco, intervaloDias || 30]
  );
  return buscarPorId(rows[0].id);
}

async function atualizar(id, dados) {
  const campos = [];
  const valores = [];
  let i = 1;

  const camposPermitidos = { nome: 'nome', preco: 'preco', intervaloDias: 'intervalo_dias', ativo: 'ativo' };

  for (const [chave, coluna] of Object.entries(camposPermitidos)) {
    if (dados[chave] !== undefined) {
      campos.push(`${coluna} = $${i++}`);
      valores.push(dados[chave]);
    }
  }

  if (campos.length === 0) return buscarPorId(id);

  await db.query(`UPDATE planos SET ${campos.join(', ')} WHERE id = $${i}`, [...valores, id]);
  return buscarPorId(id);
}

module.exports = { listarAtivos, listarTodos, buscarPorId, criar, atualizar };
