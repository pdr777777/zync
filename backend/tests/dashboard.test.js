const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { criarUsuarioEToken } = require('./helpers');

afterAll(async () => {
  await db.end();
});

async function criarLead(token, overrides = {}) {
  const resposta = await request(app)
    .post('/api/leads')
    .set('Authorization', `Bearer ${token}`)
    .send({ nome: 'Lead Teste', ...overrides });
  return resposta.body;
}

async function enviarMensagem(token, leadId, enviado_por, conteudo = 'Oi') {
  return request(app)
    .post(`/api/leads/${leadId}/mensagens`)
    .set('Authorization', `Bearer ${token}`)
    .send({ conteudo, enviado_por });
}

describe('GET /api/dashboard', () => {
  test('conta nova sem dados retorna tudo zerado', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({
      leadsHoje: 0,
      conversoes: 0,
      mensagensEnviadas: 0,
      taxaRespostaIA: 0,
      leadsPorStatus: [],
    });
  });

  test('leadsHoje conta só leads criados hoje, pelo usuario logado', async () => {
    const { token: tokenA } = await criarUsuarioEToken(app, request);
    const { token: tokenB } = await criarUsuarioEToken(app, request);

    await criarLead(tokenA);
    await criarLead(tokenA);
    await criarLead(tokenB);

    const resposta = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${tokenA}`);
    expect(resposta.body.leadsHoje).toBe(2);
  });

  test('conversoes conta só leads com status fechado', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await criarLead(token, { status: 'fechado' });
    await criarLead(token, { status: 'fechado' });
    await criarLead(token, { status: 'novo' });

    const resposta = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    expect(resposta.body.conversoes).toBe(2);
  });

  test('mensagensEnviadas conta mensagens de todos os leads do usuario', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const leadA = await criarLead(token);
    const leadB = await criarLead(token);

    await enviarMensagem(token, leadA.id, 'humano');
    await enviarMensagem(token, leadA.id, 'ia');
    await enviarMensagem(token, leadB.id, 'cliente');

    const resposta = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    expect(resposta.body.mensagensEnviadas).toBe(3);
  });

  test('taxaRespostaIA e a porcentagem de mensagens enviadas pela IA, arredondada', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token);

    await enviarMensagem(token, lead.id, 'ia');
    await enviarMensagem(token, lead.id, 'ia');
    await enviarMensagem(token, lead.id, 'humano');

    const resposta = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    expect(resposta.body.taxaRespostaIA).toBe(67);
  });

  test('leadsPorStatus agrupa a contagem por status', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await criarLead(token, { status: 'novo' });
    await criarLead(token, { status: 'novo' });
    await criarLead(token, { status: 'fechado' });

    const resposta = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    const porStatus = Object.fromEntries(resposta.body.leadsPorStatus.map((s) => [s.status, s.total]));
    expect(porStatus).toEqual({ novo: 2, fechado: 1 });
  });

  test('rejeita sem autenticação', async () => {
    const resposta = await request(app).get('/api/dashboard');
    expect(resposta.status).toBe(401);
  });
});
