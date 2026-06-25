const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { criarUsuarioEToken } = require('./helpers');

afterAll(async () => {
  await db.end();
});

async function criarProduto(token, overrides = {}) {
  const resposta = await request(app)
    .post('/api/catalogo')
    .set('Authorization', `Bearer ${token}`)
    .send({ nome: 'Produto Teste', preco: 50, ...overrides });
  return resposta.body;
}

async function obterSlug(token) {
  const resposta = await request(app).get('/api/catalogo/link').set('Authorization', `Bearer ${token}`);
  return resposta.body.slug;
}

describe('Catálogo público', () => {
  test('GET por slug retorna só produtos ativos', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await criarProduto(token, { nome: 'Ativo' });
    const inativo = await criarProduto(token, { nome: 'Inativo' });
    await request(app)
      .patch(`/api/catalogo/${inativo.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ativo: false });

    const slug = await obterSlug(token);
    const resposta = await request(app).get(`/api/catalogo-publico/${slug}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.produtos).toHaveLength(1);
    expect(resposta.body.produtos[0].nome).toBe('Ativo');
  });

  test('404 para slug inexistente', async () => {
    const resposta = await request(app).get('/api/catalogo-publico/slug-que-nao-existe');
    expect(resposta.status).toBe(404);
  });

  test('POST /solicitar cria um lead de fato', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const produto = await criarProduto(token, { nome: 'Consultoria', preco: 200 });
    const slug = await obterSlug(token);

    const resposta = await request(app)
      .post(`/api/catalogo-publico/${slug}/solicitar`)
      .send({ produtoId: produto.id, nomeCliente: 'Cliente Final', telefoneCliente: '11999990000' });
    expect(resposta.status).toBe(201);
    expect(resposta.body.sucesso).toBe(true);

    const leads = await request(app).get('/api/leads').set('Authorization', `Bearer ${token}`);
    expect(leads.body).toHaveLength(1);
    expect(leads.body[0].nome).toBe('Cliente Final');
    expect(leads.body[0].origem).toBe('catalogo');
    expect(leads.body[0].servico).toBe('Consultoria');
    expect(Number(leads.body[0].valor)).toBe(200);
  });

  test('segundo pedido com o mesmo telefone não quebra (telefone duplicado)', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const produto1 = await criarProduto(token, { nome: 'Produto 1', preco: 100 });
    const produto2 = await criarProduto(token, { nome: 'Produto 2', preco: 200 });
    const slug = await obterSlug(token);

    const primeiro = await request(app)
      .post(`/api/catalogo-publico/${slug}/solicitar`)
      .send({ produtoId: produto1.id, nomeCliente: 'Cliente Repetido', telefoneCliente: '11977776666' });
    expect(primeiro.status).toBe(201);

    const segundo = await request(app)
      .post(`/api/catalogo-publico/${slug}/solicitar`)
      .send({ produtoId: produto2.id, nomeCliente: 'Cliente Repetido', telefoneCliente: '11977776666' });
    expect(segundo.status).toBe(201);
    expect(segundo.body.sucesso).toBe(true);

    const leads = await request(app).get('/api/leads').set('Authorization', `Bearer ${token}`);
    expect(leads.body).toHaveLength(1);
  });

  test('rejeita solicitar produto de outro usuário', async () => {
    const { token: tokenA } = await criarUsuarioEToken(app, request);
    const { token: tokenB } = await criarUsuarioEToken(app, request);
    const produtoA = await criarProduto(tokenA);
    const slugB = await obterSlug(tokenB);

    const resposta = await request(app)
      .post(`/api/catalogo-publico/${slugB}/solicitar`)
      .send({ produtoId: produtoA.id, nomeCliente: 'Cliente' });
    expect(resposta.status).toBe(404);
  });

  test('rejeita solicitar produto inativo', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const produto = await criarProduto(token);
    await request(app)
      .patch(`/api/catalogo/${produto.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ativo: false });
    const slug = await obterSlug(token);

    const resposta = await request(app)
      .post(`/api/catalogo-publico/${slug}/solicitar`)
      .send({ produtoId: produto.id, nomeCliente: 'Cliente' });
    expect(resposta.status).toBe(404);
  });

  test('rejeita sem nomeCliente', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const produto = await criarProduto(token);
    const slug = await obterSlug(token);

    const resposta = await request(app)
      .post(`/api/catalogo-publico/${slug}/solicitar`)
      .send({ produtoId: produto.id });
    expect(resposta.status).toBe(400);
  });

  test('rejeita slug inexistente no solicitar', async () => {
    const resposta = await request(app)
      .post('/api/catalogo-publico/slug-que-nao-existe/solicitar')
      .send({ produtoId: 1, nomeCliente: 'Cliente' });
    expect(resposta.status).toBe(404);
  });

  test('dispara webhook lead_criado quando há integração ativa', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const produto = await criarProduto(token, { nome: 'Produto Webhook' });
    const slug = await obterSlug(token);

    await request(app)
      .post('/api/integracoes')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://exemplo.com/hook', eventos: ['lead_criado'] });

    const ORIGINAL_FETCH = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    await request(app)
      .post(`/api/catalogo-publico/${slug}/solicitar`)
      .send({ produtoId: produto.id, nomeCliente: 'Cliente Webhook' });

    for (let i = 0; i < 40; i++) {
      if (global.fetch.mock.calls.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, opcoes] = global.fetch.mock.calls[0];
    expect(JSON.parse(opcoes.body).evento).toBe('lead_criado');

    global.fetch = ORIGINAL_FETCH;
  }, 10000);
});
