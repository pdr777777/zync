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

jest.mock('../src/utils/ntfy', () => ({
  notificar: jest.fn(),
}));

const app = require('../src/app');
const ntfy = require('../src/utils/ntfy');
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

  test('reenvio do mesmo webhook completed não reprocessa nem duplica notificação', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const checkout = await fazerCheckout(token);
    ntfy.notificar.mockClear();

    const primeira = await request(app)
      .post('/api/webhooks/syncpay')
      .set('Authorization', autorizacaoWebhook())
      .send({ data: { id: checkout.body.identifier, status: 'completed' } });
    expect(primeira.status).toBe(200);

    const atualAntes = await request(app).get('/api/assinaturas/atual').set('Authorization', `Bearer ${token}`);
    const expiraAntes = atualAntes.body.expira_em;

    const reenvio = await request(app)
      .post('/api/webhooks/syncpay')
      .set('Authorization', autorizacaoWebhook())
      .send({ data: { id: checkout.body.identifier, status: 'completed' } });
    expect(reenvio.status).toBe(200);

    const atualDepois = await request(app).get('/api/assinaturas/atual').set('Authorization', `Bearer ${token}`);
    expect(atualDepois.body.expira_em).toBe(expiraAntes);
    expect(ntfy.notificar).toHaveBeenCalledTimes(1);
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

async function ativarAssinatura(token, planoId = 1) {
  const checkout = await fazerCheckout(token, { planoId });
  await request(app)
    .post('/api/webhooks/syncpay')
    .set('Authorization', autorizacaoWebhook())
    .send({ data: { id: checkout.body.identifier, status: 'completed' } });
  return checkout.body.identifier;
}

describe('POST /api/assinaturas/mudar-plano', () => {
  test('rejeita sem assinatura ativa', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .post('/api/assinaturas/mudar-plano')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoId: 2 });
    expect(resposta.status).toBe(400);
  });

  test('rejeita trocar pro mesmo plano que já está ativo', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await ativarAssinatura(token, 1);

    const resposta = await request(app)
      .post('/api/assinaturas/mudar-plano')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoId: 1, cpf: CPF_VALIDO, telefone: '11999998888' });
    expect(resposta.status).toBe(400);
  });

  test('rejeita plano inexistente', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await ativarAssinatura(token, 1);

    const resposta = await request(app)
      .post('/api/assinaturas/mudar-plano')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoId: 999999 });
    expect(resposta.status).toBe(404);
  });

  test('rejeita sem planoId', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await ativarAssinatura(token, 1);

    const resposta = await request(app)
      .post('/api/assinaturas/mudar-plano')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(resposta.status).toBe(400);
  });

  test('rejeita quando falta cpf/telefone (nem no perfil, nem no corpo)', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await ativarAssinatura(token, 1);

    const resposta = await request(app)
      .post('/api/assinaturas/mudar-plano')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoId: 2 });
    expect(resposta.status).toBe(400);
  });

  test('rejeita cpf inválido informado no corpo', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await ativarAssinatura(token, 1);

    const resposta = await request(app)
      .post('/api/assinaturas/mudar-plano')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoId: 2, cpf: '11111111111', telefone: '11999998888' });
    expect(resposta.status).toBe(400);
  });

  test('gera pix pra trocar de plano, e ao confirmar pagamento ativa o novo e cancela o antigo', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await ativarAssinatura(token, 1);

    const troca = await request(app)
      .post('/api/assinaturas/mudar-plano')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoId: 2, cpf: CPF_VALIDO, telefone: '11999998888' });

    expect(troca.status).toBe(201);
    expect(troca.body).toHaveProperty('pixCode');
    expect(troca.body).toHaveProperty('identifier');

    await request(app)
      .post('/api/webhooks/syncpay')
      .set('Authorization', autorizacaoWebhook())
      .send({ data: { id: troca.body.identifier, status: 'completed' } });

    const atual = await request(app).get('/api/assinaturas/atual').set('Authorization', `Bearer ${token}`);
    expect(atual.body.status).toBe('ativa');
    expect(atual.body.plano_id).toBe(2);

    const historico = await request(app).get('/api/assinaturas/historico').set('Authorization', `Bearer ${token}`);
    expect(historico.body).toHaveLength(2);
    const antiga = historico.body.find((a) => a.plano_id === 1);
    expect(antiga.status).toBe('cancelada');
  });

  test('usa cpf/telefone ja salvos no perfil quando nao vem no corpo', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await ativarAssinatura(token, 1);

    await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ cpf: CPF_VALIDO, telefone: '11999998888' });

    const troca = await request(app)
      .post('/api/assinaturas/mudar-plano')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoId: 2 });

    expect(troca.status).toBe(201);
  });

  test('rejeita sem autenticação', async () => {
    const resposta = await request(app).post('/api/assinaturas/mudar-plano').send({ planoId: 2 });
    expect(resposta.status).toBe(401);
  });
});
