const request = require('supertest');

jest.mock('../src/services/iaService', () => ({
  gerarResposta: jest.fn(() => Promise.resolve('Resposta mockada da IA')),
}));

const app = require('../src/app');
const db = require('../src/config/db');
const iaService = require('../src/services/iaService');
const { criarUsuarioEToken } = require('./helpers');

afterAll(async () => {
  await db.end();
});

afterEach(() => {
  iaService.gerarResposta.mockClear();
});

async function criarLead(token) {
  const resposta = await request(app)
    .post('/api/leads')
    .set('Authorization', `Bearer ${token}`)
    .send({ nome: 'Lead Teste IA' });
  return resposta.body;
}

describe('POST /api/leads/:leadId/ia/responder', () => {
  test('salva a mensagem do cliente e a resposta da IA, em ordem', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token);

    const resposta = await request(app)
      .post(`/api/leads/${lead.id}/ia/responder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ conteudo: 'Quanto custa o plano?' });

    expect(resposta.status).toBe(201);
    expect(resposta.body.mensagemCliente.conteudo).toBe('Quanto custa o plano?');
    expect(resposta.body.mensagemCliente.enviado_por).toBe('cliente');
    expect(resposta.body.mensagemIA.conteudo).toBe('Resposta mockada da IA');
    expect(resposta.body.mensagemIA.enviado_por).toBe('ia');
    expect(iaService.gerarResposta).toHaveBeenCalledWith(
      'Quanto custa o plano?',
      expect.objectContaining({ id: expect.anything() })
    );

    const historico = await request(app)
      .get(`/api/leads/${lead.id}/mensagens`)
      .set('Authorization', `Bearer ${token}`);
    expect(historico.body.map((m) => m.enviado_por)).toEqual(['cliente', 'ia']);
  });

  test('rejeita sem conteudo', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token);

    const resposta = await request(app)
      .post(`/api/leads/${lead.id}/ia/responder`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(resposta.status).toBe(400);
    expect(iaService.gerarResposta).not.toHaveBeenCalled();
  });

  test('404 pra lead inexistente', async () => {
    const { token } = await criarUsuarioEToken(app, request);

    const resposta = await request(app)
      .post('/api/leads/999999/ia/responder')
      .set('Authorization', `Bearer ${token}`)
      .send({ conteudo: 'Oi' });

    expect(resposta.status).toBe(404);
  });

  test('404 pra lead de outro usuário (isolamento entre contas)', async () => {
    const { token: tokenA } = await criarUsuarioEToken(app, request);
    const { token: tokenB } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(tokenA);

    const resposta = await request(app)
      .post(`/api/leads/${lead.id}/ia/responder`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ conteudo: 'Oi' });

    expect(resposta.status).toBe(404);
  });

  test('rejeita sem autenticação', async () => {
    const resposta = await request(app).post('/api/leads/1/ia/responder').send({ conteudo: 'Oi' });
    expect(resposta.status).toBe(401);
  });
});
