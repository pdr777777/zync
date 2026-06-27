const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { criarUsuarioEToken } = require('./helpers');

afterAll(async () => {
  await db.end();
});

async function tornarContaAntiga(usuarioId, dias = 31) {
  await db.query('UPDATE usuarios SET criado_em = NOW() - ($1 * INTERVAL \'1 day\') WHERE id = $2', [dias, usuarioId]);
}

describe('GET /api/nps/elegivel', () => {
  test('conta nova (menos de 30 dias) nao e elegivel', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app).get('/api/nps/elegivel').set('Authorization', `Bearer ${token}`);
    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ elegivel: false });
  });

  test('conta com mais de 30 dias, sem resposta e sem dispensa, e elegivel', async () => {
    const { token, usuario } = await criarUsuarioEToken(app, request);
    await tornarContaAntiga(usuario.id);

    const resposta = await request(app).get('/api/nps/elegivel').set('Authorization', `Bearer ${token}`);
    expect(resposta.body).toEqual({ elegivel: true });
  });

  test('conta antiga que ja respondeu nao e mais elegivel', async () => {
    const { token, usuario } = await criarUsuarioEToken(app, request);
    await tornarContaAntiga(usuario.id);

    await request(app).post('/api/nps').set('Authorization', `Bearer ${token}`).send({ nota: 9 });

    const resposta = await request(app).get('/api/nps/elegivel').set('Authorization', `Bearer ${token}`);
    expect(resposta.body).toEqual({ elegivel: false });
  });

  test('conta antiga que dispensou nao e mais elegivel', async () => {
    const { token, usuario } = await criarUsuarioEToken(app, request);
    await tornarContaAntiga(usuario.id);

    await request(app).post('/api/nps/dispensar').set('Authorization', `Bearer ${token}`);

    const resposta = await request(app).get('/api/nps/elegivel').set('Authorization', `Bearer ${token}`);
    expect(resposta.body).toEqual({ elegivel: false });
  });

  test('rejeita sem autenticacao', async () => {
    const resposta = await request(app).get('/api/nps/elegivel');
    expect(resposta.status).toBe(401);
  });
});

describe('POST /api/nps', () => {
  test('cria resposta com nota e comentario', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .post('/api/nps')
      .set('Authorization', `Bearer ${token}`)
      .send({ nota: 10, comentario: 'Adorei o produto' });

    expect(resposta.status).toBe(201);
    expect(resposta.body.nota).toBe(10);
    expect(resposta.body.comentario).toBe('Adorei o produto');
  });

  test('aceita nota sem comentario', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app).post('/api/nps').set('Authorization', `Bearer ${token}`).send({ nota: 5 });
    expect(resposta.status).toBe(201);
    expect(resposta.body.comentario).toBeNull();
  });

  test.each([-1, 11, 5.5, 'dez', undefined])('rejeita nota invalida: %s', async (nota) => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app).post('/api/nps').set('Authorization', `Bearer ${token}`).send({ nota });
    expect(resposta.status).toBe(400);
  });

  test('rejeita comentario com mais de 500 caracteres', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .post('/api/nps')
      .set('Authorization', `Bearer ${token}`)
      .send({ nota: 7, comentario: 'a'.repeat(501) });
    expect(resposta.status).toBe(400);
  });

  test('rejeita sem autenticacao', async () => {
    const resposta = await request(app).post('/api/nps').send({ nota: 7 });
    expect(resposta.status).toBe(401);
  });
});

describe('POST /api/nps/dispensar', () => {
  test('marca a conta como dispensada', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app).post('/api/nps/dispensar').set('Authorization', `Bearer ${token}`);
    expect(resposta.status).toBe(204);
  });

  test('rejeita sem autenticacao', async () => {
    const resposta = await request(app).post('/api/nps/dispensar');
    expect(resposta.status).toBe(401);
  });
});
