const request = require('supertest');

jest.mock('../src/services/syncpayService', () => ({
  criarCobrancaPix: jest.fn(() =>
    Promise.resolve({
      pixCode: 'pix-mock-' + Math.random().toString(36).slice(2),
      identifier: 'mock-identifier-' + Math.random().toString(36).slice(2),
    })
  ),
  consultarTransacao: jest.fn(),
}));

const app = require('../src/app');
const db = require('../src/config/db');
const { criarUsuarioEToken } = require('./helpers');

afterAll(async () => {
  await db.end();
});

const CPF_VALIDO = '52998224725';

async function fazerCheckout(token, overrides = {}) {
  return request(app)
    .post('/api/assinaturas/checkout')
    .set('Authorization', `Bearer ${token}`)
    .send({
      planoId: 1,
      nome: 'Comprador Teste',
      cpf: CPF_VALIDO,
      email: 'comprador@zync.com',
      telefone: '11999998888',
      ...overrides,
    });
}

function autorizacaoWebhook() {
  return `Bearer ${process.env.SYNCPAY_WEBHOOK_TOKEN}`;
}

describe('GET /api/planos', () => {
  test('lista os planos ativos', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app).get('/api/planos').set('Authorization', `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.length).toBeGreaterThanOrEqual(2);
  });
});

describe('POST /api/assinaturas/checkout', () => {
  test('cria assinatura pendente e retorna código pix', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await fazerCheckout(token);

    expect(resposta.status).toBe(201);
    expect(resposta.body).toHaveProperty('pixCode');
    expect(resposta.body).toHaveProperty('identifier');

    const atual = await request(app).get('/api/assinaturas/atual').set('Authorization', `Bearer ${token}`);
    expect(atual.body.status).toBe('pendente');
  });

  test('rejeita cpf inválido', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await fazerCheckout(token, { cpf: '11111111111' });
    expect(resposta.status).toBe(400);
  });

  test('rejeita plano inexistente', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await fazerCheckout(token, { planoId: 999999 });
    expect(resposta.status).toBe(404);
  });

  test('rejeita campos faltando', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .post('/api/assinaturas/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoId: 1 });
    expect(resposta.status).toBe(400);
  });
});

describe('Webhook do SyncPay + ciclo de vida da assinatura', () => {
  test('ativa assinatura ao receber confirmação de pagamento', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const checkout = await fazerCheckout(token);

    const webhook = await request(app)
      .post('/api/webhooks/syncpay')
      .set('Authorization', autorizacaoWebhook())
      .send({ data: { id: checkout.body.identifier, status: 'completed' } });
    expect(webhook.status).toBe(200);

    const atual = await request(app).get('/api/assinaturas/atual').set('Authorization', `Bearer ${token}`);
    expect(atual.body.status).toBe('ativa');
    expect(atual.body.expira_em).not.toBeNull();
  });

  test('webhook com identifier desconhecido não derruba a API', async () => {
    const resposta = await request(app)
      .post('/api/webhooks/syncpay')
      .set('Authorization', autorizacaoWebhook())
      .send({ data: { id: 'identifier-que-nao-existe', status: 'completed' } });
    expect(resposta.status).toBe(200);
  });

  test('rejeita webhook sem o token correto', async () => {
    const resposta = await request(app)
      .post('/api/webhooks/syncpay')
      .set('Authorization', 'Bearer token-errado')
      .send({ data: { id: 'qualquer', status: 'completed' } });

    expect(resposta.status).toBe(401);
  });

  test('rejeita payload sem data.id', async () => {
    const resposta = await request(app)
      .post('/api/webhooks/syncpay')
      .set('Authorization', autorizacaoWebhook())
      .send({ data: { status: 'completed' } });

    expect(resposta.status).toBe(400);
  });

  test('cancela a assinatura ao receber status failed', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const checkout = await fazerCheckout(token);

    await request(app)
      .post('/api/webhooks/syncpay')
      .set('Authorization', autorizacaoWebhook())
      .send({ data: { id: checkout.body.identifier, status: 'failed' } });

    const atual = await request(app).get('/api/assinaturas/atual').set('Authorization', `Bearer ${token}`);
    expect(atual.body.status).toBe('cancelada');
  });

  test('cancela a assinatura ao receber status refunded', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const checkout = await fazerCheckout(token);

    await request(app)
      .post('/api/webhooks/syncpay')
      .set('Authorization', autorizacaoWebhook())
      .send({ data: { id: checkout.body.identifier, status: 'refunded' } });

    const atual = await request(app).get('/api/assinaturas/atual').set('Authorization', `Bearer ${token}`);
    expect(atual.body.status).toBe('cancelada');
  });

  test('cancelar assinatura ativa e bloquear cancelamento duplicado', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const checkout = await fazerCheckout(token);

    await request(app)
      .post('/api/webhooks/syncpay')
      .set('Authorization', autorizacaoWebhook())
      .send({ data: { id: checkout.body.identifier, status: 'completed' } });

    const cancelar = await request(app)
      .post('/api/assinaturas/cancelar')
      .set('Authorization', `Bearer ${token}`);
    expect(cancelar.status).toBe(204);

    const cancelarDeNovo = await request(app)
      .post('/api/assinaturas/cancelar')
      .set('Authorization', `Bearer ${token}`);
    expect(cancelarDeNovo.status).toBe(400);

    const historico = await request(app)
      .get('/api/assinaturas/historico')
      .set('Authorization', `Bearer ${token}`);
    expect(historico.body).toHaveLength(1);
    expect(historico.body[0].status).toBe('cancelada');
  });

  test('rejeita cancelamento sem assinatura', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .post('/api/assinaturas/cancelar')
      .set('Authorization', `Bearer ${token}`);
    expect(resposta.status).toBe(400);
  });
});
