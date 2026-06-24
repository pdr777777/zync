const db = require('../config/db');

async function listarAtivos() {
  const [rows] = await db.query('SELECT * FROM planos WHERE ativo = 1 ORDER BY preco ASC, id ASC');
  return rows;
}

async function listarTodos() {
  const [rows] = await db.query('SELECT * FROM planos ORDER BY ativo DESC, preco ASC, id ASC');
  return rows;
}

async function buscarPorId(id) {
  const [rows] = await db.query('SELECT * FROM planos WHERE id = ?', [id]);
  return rows[0];
}

async function criar({ nome, preco, intervaloDias }) {
  const [result] = await db.query(
    'INSERT INTO planos (nome, preco, intervalo_dias) VALUES (?, ?, ?)',
    [nome, preco, intervaloDias || 30]
  );
  return buscarPorId(result.insertId);
}

async function atualizar(id, dados) {
  const campos = [];
  const valores = [];

  const camposPermitidos = { nome: 'nome', preco: 'preco', intervaloDias: 'intervalo_dias', ativo: 'ativo' };

  for (const [chave, coluna] of Object.entries(camposPermitidos)) {
    if (dados[chave] !== undefined) {
      campos.push(`${coluna} = ?`);
      valores.push(dados[chave]);
    }
  }

  if (campos.length === 0) return buscarPorId(id);

  await db.query(`UPDATE planos SET ${campos.join(', ')} WHERE id = ?`, [...valores, id]);
  return buscarPorId(id);
}

module.exports = { listarAtivos, listarTodos, buscarPorId, criar, atualizar };
