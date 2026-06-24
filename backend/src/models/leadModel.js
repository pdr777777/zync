const db = require('../config/db');

const CAMPOS_ATUALIZAVEIS = ['nome', 'servico', 'origem', 'telefone', 'status', 'valor'];

async function listarPorUsuario(usuarioId, { tagId, busca, status, origem, valorMin, valorMax, page, limit } = {}) {
  const joinClause = tagId ? 'INNER JOIN lead_tags lt ON lt.lead_id = l.id' : '';
  const condicoes = ['l.usuario_id = ?'];
  const params = [usuarioId];

  if (tagId) {
    condicoes.push('lt.tag_id = ?');
    params.push(tagId);
  }

  if (busca) {
    condicoes.push('(l.nome LIKE ? OR l.telefone LIKE ? OR l.servico LIKE ?)');
    const termo = `%${busca}%`;
    params.push(termo, termo, termo);
  }

  if (status) {
    condicoes.push('l.status = ?');
    params.push(status);
  }

  if (origem) {
    condicoes.push('l.origem = ?');
    params.push(origem);
  }

  if (valorMin !== undefined) {
    condicoes.push('l.valor >= ?');
    params.push(valorMin);
  }

  if (valorMax !== undefined) {
    condicoes.push('l.valor <= ?');
    params.push(valorMax);
  }

  const whereClause = condicoes.join(' AND ');

  if (page === undefined && limit === undefined) {
    const [rows] = await db.query(
      `SELECT l.* FROM leads l ${joinClause} WHERE ${whereClause} ORDER BY l.criado_em DESC, l.id DESC`,
      params
    );
    return rows;
  }

  const paginaNum = Math.max(1, parseInt(page, 10) || 1);
  const limiteNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (paginaNum - 1) * limiteNum;

  const [rows] = await db.query(
    `SELECT l.* FROM leads l ${joinClause} WHERE ${whereClause} ORDER BY l.criado_em DESC, l.id DESC LIMIT ? OFFSET ?`,
    [...params, limiteNum, offset]
  );

  const [totalRows] = await db.query(
    `SELECT COUNT(*) AS total FROM leads l ${joinClause} WHERE ${whereClause}`,
    params
  );
  const total = totalRows[0].total;

  return {
    dados: rows,
    pagina: paginaNum,
    limite: limiteNum,
    total,
    totalPaginas: Math.ceil(total / limiteNum),
  };
}

async function listarInbox(usuarioId) {
  const [rows] = await db.query(
    `SELECT l.*, m.conteudo AS ultima_mensagem, m.enviado_por AS ultima_mensagem_de, m.criado_em AS ultima_mensagem_em
     FROM leads l
     LEFT JOIN (
       SELECT lead_id, conteudo, enviado_por, criado_em,
              ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY criado_em DESC, id DESC) AS rn
       FROM mensagens
     ) m ON m.lead_id = l.id AND m.rn = 1
     WHERE l.usuario_id = ?
     ORDER BY COALESCE(m.criado_em, l.criado_em) DESC, l.id DESC`,
    [usuarioId]
  );
  return rows;
}

async function buscarPorId(id, usuarioId) {
  const [rows] = await db.query(
    'SELECT * FROM leads WHERE id = ? AND usuario_id = ?',
    [id, usuarioId]
  );
  return rows[0];
}

async function buscarPorTelefone(telefone, usuarioId) {
  const [rows] = await db.query(
    'SELECT * FROM leads WHERE telefone = ? AND usuario_id = ?',
    [telefone, usuarioId]
  );
  return rows[0];
}

async function criar({ usuarioId, nome, servico, origem, telefone, status, valor }) {
  const statusFinal = status || 'novo';
  const [result] = await db.query(
    'INSERT INTO leads (usuario_id, nome, servico, origem, telefone, status, valor, fechado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      usuarioId,
      nome,
      servico || null,
      origem || null,
      telefone || null,
      statusFinal,
      valor || null,
      statusFinal === 'fechado' ? new Date() : null,
    ]
  );
  return buscarPorId(result.insertId, usuarioId);
}

async function atualizar(id, usuarioId, dados) {
  const campos = [];
  const valores = [];

  for (const campo of CAMPOS_ATUALIZAVEIS) {
    if (dados[campo] !== undefined) {
      campos.push(`${campo} = ?`);
      valores.push(dados[campo]);
    }
  }

  if (dados.status !== undefined) {
    campos.push('fechado_em = ?');
    valores.push(dados.status === 'fechado' ? new Date() : null);
  }

  if (campos.length === 0) return buscarPorId(id, usuarioId);

  await db.query(
    `UPDATE leads SET ${campos.join(', ')} WHERE id = ? AND usuario_id = ?`,
    [...valores, id, usuarioId]
  );

  return buscarPorId(id, usuarioId);
}

async function remover(id, usuarioId) {
  await db.query('DELETE FROM leads WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
}

module.exports = { listarPorUsuario, listarInbox, buscarPorId, buscarPorTelefone, criar, atualizar, remover };
