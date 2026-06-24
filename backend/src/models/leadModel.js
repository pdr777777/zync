const db = require('../config/db');

const CAMPOS_ATUALIZAVEIS = ['nome', 'servico', 'origem', 'telefone', 'status', 'valor'];

async function listarPorUsuario(usuarioId, { tagId, busca, status, origem, valorMin, valorMax, page, limit } = {}) {
  const joinClause = tagId ? 'INNER JOIN lead_tags lt ON lt.lead_id = l.id' : '';
  const condicoes = ['l.usuario_id = $1'];
  const params = [usuarioId];

  if (tagId) {
    params.push(tagId);
    condicoes.push(`lt.tag_id = $${params.length}`);
  }

  if (busca) {
    const termo = `%${busca}%`;
    params.push(termo, termo, termo);
    condicoes.push(`(l.nome LIKE $${params.length - 2} OR l.telefone LIKE $${params.length - 1} OR l.servico LIKE $${params.length})`);
  }

  if (status) {
    params.push(status);
    condicoes.push(`l.status = $${params.length}`);
  }

  if (origem) {
    params.push(origem);
    condicoes.push(`l.origem = $${params.length}`);
  }

  if (valorMin !== undefined) {
    params.push(valorMin);
    condicoes.push(`l.valor >= $${params.length}`);
  }

  if (valorMax !== undefined) {
    params.push(valorMax);
    condicoes.push(`l.valor <= $${params.length}`);
  }

  const whereClause = condicoes.join(' AND ');

  if (page === undefined && limit === undefined) {
    const { rows } = await db.query(
      `SELECT l.* FROM leads l ${joinClause} WHERE ${whereClause} ORDER BY l.criado_em DESC, l.id DESC`,
      params
    );
    return rows;
  }

  const paginaNum = Math.max(1, parseInt(page, 10) || 1);
  const limiteNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (paginaNum - 1) * limiteNum;

  const { rows } = await db.query(
    `SELECT l.* FROM leads l ${joinClause} WHERE ${whereClause} ORDER BY l.criado_em DESC, l.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limiteNum, offset]
  );

  const { rows: totalRows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM leads l ${joinClause} WHERE ${whereClause}`,
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
  const { rows } = await db.query(
    `SELECT l.*, m.conteudo AS ultima_mensagem, m.enviado_por AS ultima_mensagem_de, m.criado_em AS ultima_mensagem_em
     FROM leads l
     LEFT JOIN (
       SELECT lead_id, conteudo, enviado_por, criado_em,
              ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY criado_em DESC, id DESC) AS rn
       FROM mensagens
     ) m ON m.lead_id = l.id AND m.rn = 1
     WHERE l.usuario_id = $1
     ORDER BY COALESCE(m.criado_em, l.criado_em) DESC, l.id DESC`,
    [usuarioId]
  );
  return rows;
}

async function buscarPorId(id, usuarioId) {
  const { rows } = await db.query(
    'SELECT * FROM leads WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId]
  );
  return rows[0];
}

async function buscarPorTelefone(telefone, usuarioId) {
  const { rows } = await db.query(
    'SELECT * FROM leads WHERE telefone = $1 AND usuario_id = $2',
    [telefone, usuarioId]
  );
  return rows[0];
}

async function criar({ usuarioId, nome, servico, origem, telefone, status, valor }) {
  const statusFinal = status || 'novo';
  const { rows } = await db.query(
    'INSERT INTO leads (usuario_id, nome, servico, origem, telefone, status, valor, fechado_em) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
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
  return buscarPorId(rows[0].id, usuarioId);
}

async function atualizar(id, usuarioId, dados) {
  const campos = [];
  const valores = [];
  let i = 1;

  for (const campo of CAMPOS_ATUALIZAVEIS) {
    if (dados[campo] !== undefined) {
      campos.push(`${campo} = $${i++}`);
      valores.push(dados[campo]);
    }
  }

  if (dados.status !== undefined) {
    campos.push(`fechado_em = $${i++}`);
    valores.push(dados.status === 'fechado' ? new Date() : null);
  }

  if (campos.length === 0) return buscarPorId(id, usuarioId);

  await db.query(
    `UPDATE leads SET ${campos.join(', ')} WHERE id = $${i++} AND usuario_id = $${i}`,
    [...valores, id, usuarioId]
  );

  return buscarPorId(id, usuarioId);
}

async function remover(id, usuarioId) {
  await db.query('DELETE FROM leads WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
}

module.exports = { listarPorUsuario, listarInbox, buscarPorId, buscarPorTelefone, criar, atualizar, remover };
