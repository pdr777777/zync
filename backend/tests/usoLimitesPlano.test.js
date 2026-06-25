const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { criarUsuarioEToken } = require('./helpers');
const { verificarLimitesEAvisar } = require('../src/services/usoService');

afterAll(async () => {
  await db.end();
});

async function criarPlanoComLimite({ limiteLeads = null, limiteMensagens = null } = {}) {
  const { rows } = await db.query(
    `INSERT INTO planos (nome, preco, intervalo_dias, limite_leads_mes, limite_mensagens_mes)
     VALUES ('Plano Teste Limite', 97, 30, $1, $2) RETURNING id`,
    [limiteLeads, limiteMensagens]
  );
  return rows[0].id;
}

async function darAssinaturaAtiva(usuarioId, planoId) {
  await db.query(
    `INSERT INTO assinaturas (usuario_id, plano_id, status, valor, syncpay_identifier)
     VALUES ($1, $2, 'ativa', 97, $3)`,
    [usuarioId, planoId, `uso-test-${Date.now()}-${Math.random()}`]
  );
}

async function criarLead(token, telefone) {
  const resposta = await request(app)
    .post('/api/leads')
    .set('Authorization', `Bearer ${token}`)
    .send({ nome: 'Lead Uso', telefone });
  return resposta.body;
}

describe('GET /api/assinaturas/uso', () => {
  test('sem assinatura, retorna limites nulos mas contagem zerada', async () => {
    const { token } = await criarUsuarioEToken(app, request);

    const resposta = await request(app).get('/api/assinaturas/uso').set('Authorization', `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.plano).toBeNull();
    expect(resposta.body.leads.limite).toBeNull();
    expect(resposta.body.mensagens.limite).toBeNull();
  });

  test('com plano limitado, conta leads criados no mês', async () => {
    const { token, usuario } = await criarUsuarioEToken(app, request);
    const planoId = await criarPlanoComLimite({ limiteLeads: 2, limiteMensagens: 5 });
    await darAssinaturaAtiva(usuario.id, planoId);

    await criarLead(token, '11900000001');
    await criarLead(token, '11900000002');

    const resposta = await request(app).get('/api/assinaturas/uso').set('Authorization', `Bearer ${token}`);

    expect(resposta.body.plano).toBe('Plano Teste Limite');
    expect(resposta.body.leads).toEqual({ usado: 2, limite: 2 });
  });
});

describe('usoService.verificarLimitesEAvisar', () => {
  test('avisa quando passa do limite de leads e não bloqueia a criação', async () => {
    const { token, usuario } = await criarUsuarioEToken(app, request);
    const planoId = await criarPlanoComLimite({ limiteLeads: 1 });
    await darAssinaturaAtiva(usuario.id, planoId);

    const primeiro = await criarLead(token, '11900000010');
    const segundo = await criarLead(token, '11900000011');

    expect(primeiro.id).toBeDefined();
    expect(segundo.id).toBeDefined();

    const notificacoes = await request(app).get('/api/notificacoes').set('Authorization', `Bearer ${token}`);
    expect(notificacoes.body.some((n) => n.tipo === 'limite_leads_excedido')).toBe(true);
  });

  test('não duplica o aviso no mesmo mês', async () => {
    const { token, usuario } = await criarUsuarioEToken(app, request);
    const planoId = await criarPlanoComLimite({ limiteLeads: 1 });
    await darAssinaturaAtiva(usuario.id, planoId);

    await criarLead(token, '11900000020');
    await criarLead(token, '11900000021');
    await verificarLimitesEAvisar(usuario.id);
    await verificarLimitesEAvisar(usuario.id);

    const notificacoes = await request(app).get('/api/notificacoes').set('Authorization', `Bearer ${token}`);
    const avisos = notificacoes.body.filter((n) => n.tipo === 'limite_leads_excedido');
    expect(avisos).toHaveLength(1);
  });

  test('plano sem limite (ilimitado) nunca avisa', async () => {
    const { token, usuario } = await criarUsuarioEToken(app, request);
    const planoId = await criarPlanoComLimite({ limiteLeads: null, limiteMensagens: null });
    await darAssinaturaAtiva(usuario.id, planoId);

    await criarLead(token, '11900000030');
    await verificarLimitesEAvisar(usuario.id);

    const notificacoes = await request(app).get('/api/notificacoes').set('Authorization', `Bearer ${token}`);
    expect(notificacoes.body.some((n) => n.tipo === 'limite_leads_excedido')).toBe(false);
  });

  test('usuário sem nenhuma assinatura não quebra e não avisa', async () => {
    const { usuario } = await criarUsuarioEToken(app, request);
    await expect(verificarLimitesEAvisar(usuario.id)).resolves.not.toThrow();
  });
});
