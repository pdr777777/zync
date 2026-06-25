const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const usuarioModel = require('../src/models/usuarioModel');
const { criarUsuarioEToken } = require('./helpers');

afterAll(async () => {
  await db.end();
});

const APP_SECRET = 'segredo-app-teste';

function assinar(payload) {
  const corpo = JSON.stringify(payload);
  return 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(corpo).digest('hex');
}

function payloadMensagem({ phoneNumberId, telefone, nome, texto }) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-id',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '550000000', phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: nome }, wa_id: telefone }],
              messages: [{ from: telefone, id: 'wamid.teste', timestamp: '1234567890', type: 'text', text: { body: texto } }],
            },
          },
        ],
      },
    ],
  };
}

function payloadStatus({ phoneNumberId }) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-id',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '550000000', phone_number_id: phoneNumberId },
              statuses: [{ id: 'wamid.teste', status: 'delivered' }],
            },
          },
        ],
      },
    ],
  };
}

describe('GET /api/webhooks/whatsapp-meta (handshake de verificação)', () => {
  const ORIGINAL_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  afterEach(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = ORIGINAL_VERIFY_TOKEN;
  });

  test('responde o challenge com o token correto', async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'token-verify-teste';

    const resposta = await request(app)
      .get('/api/webhooks/whatsapp-meta')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'token-verify-teste', 'hub.challenge': 'desafio-123' });

    expect(resposta.status).toBe(200);
    expect(resposta.text).toBe('desafio-123');
  });

  test('rejeita com token errado', async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'token-verify-teste';

    const resposta = await request(app)
      .get('/api/webhooks/whatsapp-meta')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'token-errado', 'hub.challenge': 'desafio-123' });

    expect(resposta.status).toBe(403);
  });
});

describe('POST /api/webhooks/whatsapp-meta (recebimento real)', () => {
  const ORIGINAL_APP_SECRET = process.env.WHATSAPP_APP_SECRET;

  afterEach(() => {
    process.env.WHATSAPP_APP_SECRET = ORIGINAL_APP_SECRET;
  });

  test('bloqueia (503) se WHATSAPP_APP_SECRET nao estiver configurada', async () => {
    delete process.env.WHATSAPP_APP_SECRET;
    const payload = payloadMensagem({ phoneNumberId: '999', telefone: '11999998888', nome: 'Cliente', texto: 'Oi' });

    const resposta = await request(app)
      .post('/api/webhooks/whatsapp-meta')
      .send(payload);

    expect(resposta.status).toBe(503);
  });

  test('rejeita (401) com assinatura invalida', async () => {
    process.env.WHATSAPP_APP_SECRET = APP_SECRET;
    const payload = payloadMensagem({ phoneNumberId: '999', telefone: '11999998888', nome: 'Cliente', texto: 'Oi' });

    const resposta = await request(app)
      .post('/api/webhooks/whatsapp-meta')
      .set('x-hub-signature-256', 'sha256=assinaturaerrada')
      .send(payload);

    expect(resposta.status).toBe(401);
  });

  test('com assinatura valida e phone_number_id conhecido, cria lead e mensagens', async () => {
    process.env.WHATSAPP_APP_SECRET = APP_SECRET;
    const { token, usuario } = await criarUsuarioEToken(app, request);
    await usuarioModel.atualizar(usuario.id, { whatsapp_phone_number_id: 'phone-123' });

    const payload = payloadMensagem({ phoneNumberId: 'phone-123', telefone: '11988887777', nome: 'Cliente Meta', texto: 'Quero agendar' });

    const resposta = await request(app)
      .post('/api/webhooks/whatsapp-meta')
      .set('x-hub-signature-256', assinar(payload))
      .send(payload);

    expect(resposta.status).toBe(200);

    const leads = await request(app).get('/api/leads').set('Authorization', `Bearer ${token}`);
    expect(leads.body).toHaveLength(1);
    expect(leads.body[0].telefone).toBe('11988887777');

    const mensagens = await request(app)
      .get(`/api/leads/${leads.body[0].id}/mensagens`)
      .set('Authorization', `Bearer ${token}`);
    expect(mensagens.body.map((m) => m.enviado_por)).toEqual(['cliente', 'ia']);
  });

  test('com phone_number_id desconhecido, nao quebra e nao cria nada', async () => {
    process.env.WHATSAPP_APP_SECRET = APP_SECRET;
    const payload = payloadMensagem({ phoneNumberId: 'phone-inexistente', telefone: '11977776666', nome: 'Cliente', texto: 'Oi' });

    const resposta = await request(app)
      .post('/api/webhooks/whatsapp-meta')
      .set('x-hub-signature-256', assinar(payload))
      .send(payload);

    expect(resposta.status).toBe(200);
  });

  test('ignora payload de status (sem messages)', async () => {
    process.env.WHATSAPP_APP_SECRET = APP_SECRET;
    const payload = payloadStatus({ phoneNumberId: 'phone-123' });

    const resposta = await request(app)
      .post('/api/webhooks/whatsapp-meta')
      .set('x-hub-signature-256', assinar(payload))
      .send(payload);

    expect(resposta.status).toBe(200);
  });
});
