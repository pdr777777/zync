const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { criarUsuarioEToken } = require('./helpers');

afterAll(async () => {
  await db.end();
});

function autorizacaoWebhook() {
  return `Bearer ${process.env.WHATSAPP_WEBHOOK_TOKEN}`;
}

describe('POST /api/webhooks/whatsapp/:usuarioId', () => {
  test('rejeita sem o token correto', async () => {
    const { usuario } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .post(`/api/webhooks/whatsapp/${usuario.id}`)
      .set('Authorization', 'Bearer token-errado')
      .send({ telefone: '11999998888', nome: 'Cliente Novo', mensagem: 'Oi' });

    expect(resposta.status).toBe(401);
  });

  test('cria lead e mensagens, gera notificação', async () => {
    const { token, usuario } = await criarUsuarioEToken(app, request);

    const resposta = await request(app)
      .post(`/api/webhooks/whatsapp/${usuario.id}`)
      .set('Authorization', autorizacaoWebhook())
      .send({ telefone: '11988887777', nome: 'Cliente WhatsApp', mensagem: 'Olá, gostaria de informações' });
    expect(resposta.status).toBe(200);

    const leads = await request(app).get('/api/leads').set('Authorization', `Bearer ${token}`);
    expect(leads.body).toHaveLength(1);
    expect(leads.body[0].telefone).toBe('11988887777');

    const mensagens = await request(app)
      .get(`/api/leads/${leads.body[0].id}/mensagens`)
      .set('Authorization', `Bearer ${token}`);
    expect(mensagens.body.map((m) => m.enviado_por)).toEqual(['cliente', 'ia']);

    const notificacoes = await request(app)
      .get('/api/notificacoes')
      .set('Authorization', `Bearer ${token}`);
    expect(notificacoes.body.some((n) => n.tipo === 'mensagem_recebida')).toBe(true);
  });

  test('reaproveita lead existente pelo telefone em mensagens seguintes', async () => {
    const { token, usuario } = await criarUsuarioEToken(app, request);

    for (const mensagem of ['Primeira mensagem', 'Segunda mensagem']) {
      await request(app)
        .post(`/api/webhooks/whatsapp/${usuario.id}`)
        .set('Authorization', autorizacaoWebhook())
        .send({ telefone: '11977776666', nome: 'Cliente Recorrente', mensagem });
    }

    const leads = await request(app).get('/api/leads').set('Authorization', `Bearer ${token}`);
    expect(leads.body).toHaveLength(1);
  });

  test('IA responde usando a configuração da empresa (nome, o que vende, horário, tom)', async () => {
    const ORIGINAL_FETCH = global.fetch;
    const ORIGINAL_API_KEY = process.env.ANTHROPIC_API_KEY;

    try {
      const { token, usuario } = await criarUsuarioEToken(app, request);

      await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nome_empresa: 'Studio Beleza & Cia',
          ia_o_que_vende: 'Limpeza de pele e design de sobrancelha',
          ia_horario_funcionamento: 'Seg a sáb, 9h às 19h',
          ia_tom_de_voz: 'formal',
        });

      process.env.ANTHROPIC_API_KEY = 'chave-teste';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: 'Resposta personalizada' }] }),
      });

      await request(app)
        .post(`/api/webhooks/whatsapp/${usuario.id}`)
        .set('Authorization', autorizacaoWebhook())
        .send({ telefone: '11966665555', nome: 'Cliente Curioso', mensagem: 'Qual o horário de vocês?' });

      expect(global.fetch).toHaveBeenCalled();
      const corpo = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(corpo.system).toContain('Studio Beleza & Cia');
      expect(corpo.system).toContain('Limpeza de pele e design de sobrancelha');
      expect(corpo.system).toContain('Seg a sáb, 9h às 19h');
      expect(corpo.system).toMatch(/formal/i);
    } finally {
      global.fetch = ORIGINAL_FETCH;
      process.env.ANTHROPIC_API_KEY = ORIGINAL_API_KEY;
    }
  });
});
