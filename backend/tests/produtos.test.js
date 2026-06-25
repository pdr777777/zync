const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { criarUsuarioEToken } = require('./helpers');

afterAll(async () => {
  await db.end();
});

function dadosValidos(overrides = {}) {
  return {
    nome: 'Camiseta Zync',
    descricao: 'Camiseta 100% algodão',
    preco: 79.9,
    ...overrides,
  };
}

describe('Catálogo de produtos (CRUD)', () => {
  test('cria, lista, atualiza e remove um produto', async () => {
    const { token } = await criarUsuarioEToken(app, request);

    const criado = await request(app)
      .post('/api/catalogo')
      .set('Authorization', `Bearer ${token}`)
      .send(dadosValidos());
    expect(criado.status).toBe(201);
    expect(criado.body.nome).toBe('Camiseta Zync');
    expect(Number(criado.body.preco)).toBe(79.9);
    expect(criado.body.ativo).toBe(true);

    const lista = await request(app).get('/api/catalogo').set('Authorization', `Bearer ${token}`);
    expect(lista.body).toHaveLength(1);

    const atualizado = await request(app)
      .patch(`/api/catalogo/${criado.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ativo: false, preco: 99.9 });
    expect(atualizado.status).toBe(200);
    expect(atualizado.body.ativo).toBe(false);
    expect(Number(atualizado.body.preco)).toBe(99.9);

    const removido = await request(app)
      .delete(`/api/catalogo/${criado.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(removido.status).toBe(204);

    const listaDepois = await request(app).get('/api/catalogo').set('Authorization', `Bearer ${token}`);
    expect(listaDepois.body).toHaveLength(0);
  });

  test('rejeita sem nome', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .post('/api/catalogo')
      .set('Authorization', `Bearer ${token}`)
      .send({ preco: 10 });
    expect(resposta.status).toBe(400);
  });

  test('rejeita sem preco', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .post('/api/catalogo')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Produto sem preço' });
    expect(resposta.status).toBe(400);
  });

  test('rejeita preco negativo', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .post('/api/catalogo')
      .set('Authorization', `Bearer ${token}`)
      .send(dadosValidos({ preco: -5 }));
    expect(resposta.status).toBe(400);
  });

  test('404 em produto de outro usuário', async () => {
    const { token: tokenA } = await criarUsuarioEToken(app, request);
    const { token: tokenB } = await criarUsuarioEToken(app, request);

    const criado = await request(app)
      .post('/api/catalogo')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(dadosValidos());

    const resposta = await request(app)
      .delete(`/api/catalogo/${criado.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resposta.status).toBe(404);
  });

  test('rejeita sem autenticação', async () => {
    const resposta = await request(app).get('/api/catalogo');
    expect(resposta.status).toBe(401);
  });

  test('/link gera e reutiliza o mesmo slug', async () => {
    const { token } = await criarUsuarioEToken(app, request);

    const primeira = await request(app).get('/api/catalogo/link').set('Authorization', `Bearer ${token}`);
    expect(primeira.status).toBe(200);
    expect(typeof primeira.body.slug).toBe('string');
    expect(primeira.body.url).toContain(primeira.body.slug);

    const segunda = await request(app).get('/api/catalogo/link').set('Authorization', `Bearer ${token}`);
    expect(segunda.body.slug).toBe(primeira.body.slug);
  });
});
