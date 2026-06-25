const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { criarUsuarioEToken } = require('./helpers');

afterAll(async () => {
  await db.end();
});

describe('Suporte', () => {
  test('cria mensagem de suporte e lista só as do próprio usuário', async () => {
    const { token: tokenA } = await criarUsuarioEToken(app, request);
    const { token: tokenB } = await criarUsuarioEToken(app, request);

    const criada = await request(app)
      .post('/api/suporte')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ mensagem: 'Não consigo acessar o dashboard' });
    expect(criada.status).toBe(201);
    expect(criada.body.mensagem).toBe('Não consigo acessar o dashboard');
    expect(criada.body.respondida).toBe(false);

    const listaA = await request(app).get('/api/suporte').set('Authorization', `Bearer ${tokenA}`);
    expect(listaA.body).toHaveLength(1);

    const listaB = await request(app).get('/api/suporte').set('Authorization', `Bearer ${tokenB}`);
    expect(listaB.body).toHaveLength(0);
  });

  test('aceita videoUrl opcional', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .post('/api/suporte')
      .set('Authorization', `Bearer ${token}`)
      .send({ mensagem: 'Segue o print do erro', videoUrl: 'https://exemplo.com/video.mp4' });

    expect(resposta.status).toBe(201);
    expect(resposta.body.video_url).toBe('https://exemplo.com/video.mp4');
  });

  test('rejeita sem mensagem', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app).post('/api/suporte').set('Authorization', `Bearer ${token}`).send({});
    expect(resposta.status).toBe(400);
  });

  test('rejeita sem autenticação', async () => {
    const resposta = await request(app).get('/api/suporte');
    expect(resposta.status).toBe(401);
  });
});
