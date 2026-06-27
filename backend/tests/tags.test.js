const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { criarUsuarioEToken } = require('./helpers');
const campanhaService = require('../src/services/campanhaService');

afterAll(async () => {
  await db.end();
});

async function criarLead(token, nome = 'Lead com tag') {
  const resposta = await request(app)
    .post('/api/leads')
    .set('Authorization', `Bearer ${token}`)
    .send({ nome });
  return resposta.body;
}

describe('Tags', () => {
  test('cria, lista e remove tag', async () => {
    const { token } = await criarUsuarioEToken(app, request);

    const criar = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'VIP' });
    expect(criar.status).toBe(201);

    const listar = await request(app).get('/api/tags').set('Authorization', `Bearer ${token}`);
    expect(listar.body).toHaveLength(1);

    const remover = await request(app)
      .delete(`/api/tags/${criar.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(remover.status).toBe(204);
  });

  test('rejeita tag duplicada para o mesmo usuário', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await request(app).post('/api/tags').set('Authorization', `Bearer ${token}`).send({ nome: 'Repetida' });

    const resposta = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Repetida' });

    expect(resposta.status).toBe(409);
  });

  test('associa e desassocia tag de um lead', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token);
    const tag = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Urgente' });

    const associar = await request(app)
      .post(`/api/leads/${lead.id}/tags`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tagId: tag.body.id });
    expect(associar.status).toBe(201);

    const listarDoLead = await request(app)
      .get(`/api/leads/${lead.id}/tags`)
      .set('Authorization', `Bearer ${token}`);
    expect(listarDoLead.body).toHaveLength(1);
    expect(listarDoLead.body[0].nome).toBe('Urgente');

    const desassociar = await request(app)
      .delete(`/api/leads/${lead.id}/tags/${tag.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(desassociar.status).toBe(204);

    const listarDepois = await request(app)
      .get(`/api/leads/${lead.id}/tags`)
      .set('Authorization', `Bearer ${token}`);
    expect(listarDepois.body).toHaveLength(0);
  });

  test('remover lead remove a associação de tag (cascade)', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token);
    const tag = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Cascata' });

    await request(app)
      .post(`/api/leads/${lead.id}/tags`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tagId: tag.body.id });

    const remover = await request(app)
      .delete(`/api/leads/${lead.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(remover.status).toBe(204);
  });
});

describe('Campanha por tag (mensagem em massa)', () => {
  async function criarTagComLeads(token, { comTelefone, semTelefone } = {}) {
    const tag = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: `Campanha ${Date.now()}-${Math.random()}` });

    for (let i = 0; i < (comTelefone || 0); i++) {
      const lead = await criarLead(token, `Lead com telefone ${i}`);
      await request(app)
        .put(`/api/leads/${lead.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ telefone: `1190000${i.toString().padStart(4, '0')}` });
      await request(app)
        .post(`/api/leads/${lead.id}/tags`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tagId: tag.body.id });
    }

    for (let i = 0; i < (semTelefone || 0); i++) {
      const lead = await criarLead(token, `Lead sem telefone ${i}`);
      await request(app)
        .post(`/api/leads/${lead.id}/tags`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tagId: tag.body.id });
    }

    return tag.body;
  }

  test('GET /api/tags/:id/contagem retorna total e quantos têm telefone', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const tag = await criarTagComLeads(token, { comTelefone: 2, semTelefone: 1 });

    const resposta = await request(app)
      .get(`/api/tags/${tag.id}/contagem`)
      .set('Authorization', `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ total: 3, comTelefone: 2 });
  });

  test('404 pra contagem de tag de outro usuário', async () => {
    const { token: tokenA } = await criarUsuarioEToken(app, request);
    const { token: tokenB } = await criarUsuarioEToken(app, request);
    const tag = await criarTagComLeads(tokenA, { comTelefone: 1 });

    const resposta = await request(app)
      .get(`/api/tags/${tag.id}/contagem`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(resposta.status).toBe(404);
  });

  test('POST /api/tags/:id/disparar rejeita sem mensagem', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const tag = await criarTagComLeads(token, { comTelefone: 1 });

    const resposta = await request(app)
      .post(`/api/tags/${tag.id}/disparar`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(resposta.status).toBe(400);
  });

  test('POST /api/tags/:id/disparar responde 202 com a contagem, sem esperar o envio terminar', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const tag = await criarTagComLeads(token, { comTelefone: 2, semTelefone: 1 });

    const resposta = await request(app)
      .post(`/api/tags/${tag.id}/disparar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mensagem: 'Promoção especial só hoje!' });

    expect(resposta.status).toBe(202);
    expect(resposta.body).toEqual({ totalLeads: 3, comTelefone: 2 });
  });

  test('POST /api/tags/:id/disparar enfileira um job em vez de disparar na hora', async () => {
    const { token, usuario } = await criarUsuarioEToken(app, request);
    const tag = await criarTagComLeads(token, { comTelefone: 2, semTelefone: 1 });

    await request(app)
      .post(`/api/tags/${tag.id}/disparar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mensagem: 'Promoção especial só hoje!' });

    const { rows } = await db.query("SELECT * FROM jobs WHERE tipo = 'disparar_campanha' ORDER BY id DESC LIMIT 1");
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pendente');
    expect(rows[0].payload.tagId).toBe(tag.id);
    expect(rows[0].payload.usuarioId).toBe(usuario.id);
    expect(rows[0].payload.leads).toHaveLength(2);
  });

  test('campanhaService.disparar manda mensagem só pra quem tem telefone e notifica ao concluir', async () => {
    const { token, usuario } = await criarUsuarioEToken(app, request);
    const tag = await criarTagComLeads(token, { comTelefone: 2, semTelefone: 1 });

    const leadsResposta = await request(app)
      .get('/api/leads')
      .set('Authorization', `Bearer ${token}`);
    const comTelefone = leadsResposta.body.filter((l) => l.telefone);

    await campanhaService.disparar({
      usuarioId: usuario.id,
      tagId: tag.id,
      tagNome: tag.nome,
      mensagem: 'Promoção especial só hoje!',
      leads: comTelefone,
    });

    for (const lead of comTelefone) {
      const mensagens = await request(app)
        .get(`/api/leads/${lead.id}/mensagens`)
        .set('Authorization', `Bearer ${token}`);
      expect(mensagens.body.some((m) => m.conteudo === 'Promoção especial só hoje!' && m.enviado_por === 'humano')).toBe(true);
    }

    const notificacoes = await request(app).get('/api/notificacoes').set('Authorization', `Bearer ${token}`);
    expect(notificacoes.body.some((n) => n.tipo === 'campanha_concluida' && n.mensagem.includes(tag.nome))).toBe(true);
  });
});
