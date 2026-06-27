const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { criarUsuarioEToken } = require('./helpers');

afterAll(async () => {
  await db.end();
});

async function criarLead(token, dados = {}) {
  const resposta = await request(app)
    .post('/api/leads')
    .set('Authorization', `Bearer ${token}`)
    .send({ nome: 'Lead Teste', ...dados });
  return resposta;
}

describe('POST /api/leads', () => {
  test('cria lead com nome apenas', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await criarLead(token);

    expect(resposta.status).toBe(201);
    expect(resposta.body.status).toBe('novo');
    expect(resposta.body.fechado_em).toBeNull();
  });

  test('rejeita lead sem nome', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app).post('/api/leads').set('Authorization', `Bearer ${token}`).send({});

    expect(resposta.status).toBe(400);
  });

  test('rejeita status inválido', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await criarLead(token, { status: 'inexistente' });

    expect(resposta.status).toBe(400);
  });

  test('seta fechado_em automaticamente ao criar já fechado', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await criarLead(token, { status: 'fechado', valor: 100 });

    expect(resposta.body.status).toBe('fechado');
    expect(resposta.body.fechado_em).not.toBeNull();
  });

  test('rejeita valor negativo', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await criarLead(token, { valor: -10 });
    expect(resposta.status).toBe(400);
  });

  test.each([
    ['nome', 'a'.repeat(121)],
    ['servico', 'a'.repeat(121)],
    ['origem', 'a'.repeat(61)],
    ['telefone', 'a'.repeat(21)],
  ])('rejeita %s acima do tamanho máximo', async (campo, valor) => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await criarLead(token, { [campo]: valor });
    expect(resposta.status).toBe(400);
  });

  test('exige token de autenticação', async () => {
    const resposta = await request(app).post('/api/leads').send({ nome: 'Sem token' });
    expect(resposta.status).toBe(401);
  });
});

describe('GET /api/leads', () => {
  test('lista apenas leads do próprio usuário', async () => {
    const userA = await criarUsuarioEToken(app, request);
    const userB = await criarUsuarioEToken(app, request);

    await criarLead(userA.token, { nome: 'Lead A1' });
    await criarLead(userA.token, { nome: 'Lead A2' });
    await criarLead(userB.token, { nome: 'Lead B1' });

    const respostaA = await request(app).get('/api/leads').set('Authorization', `Bearer ${userA.token}`);
    const respostaB = await request(app).get('/api/leads').set('Authorization', `Bearer ${userB.token}`);

    expect(respostaA.body).toHaveLength(2);
    expect(respostaB.body).toHaveLength(1);
    expect(respostaA.body.every((l) => l.nome.startsWith('Lead A'))).toBe(true);
  });

  test('busca textual encontra por nome parcial', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await criarLead(token, { nome: 'Maria Silva' });
    await criarLead(token, { nome: 'Mariana Costa' });
    await criarLead(token, { nome: 'Joao Pereira' });

    const resposta = await request(app)
      .get('/api/leads?busca=mari')
      .set('Authorization', `Bearer ${token}`);

    expect(resposta.body).toHaveLength(2);
  });

  test('filtra por status e por faixa de valor', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await criarLead(token, { nome: 'Fechado caro', status: 'fechado', valor: 900 });
    await criarLead(token, { nome: 'Fechado barato', status: 'fechado', valor: 50 });
    await criarLead(token, { nome: 'Novo', status: 'novo' });

    const porStatus = await request(app)
      .get('/api/leads?status=fechado')
      .set('Authorization', `Bearer ${token}`);
    expect(porStatus.body).toHaveLength(2);

    const porValor = await request(app)
      .get('/api/leads?valorMin=100&valorMax=1000')
      .set('Authorization', `Bearer ${token}`);
    expect(porValor.body).toHaveLength(1);
    expect(porValor.body[0].nome).toBe('Fechado caro');
  });

  test('rejeita valorMin de filtro inválido', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .get('/api/leads?valorMin=abc')
      .set('Authorization', `Bearer ${token}`);
    expect(resposta.status).toBe(400);
  });

  test('rejeita valorMax de filtro inválido', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .get('/api/leads?valorMax=-5')
      .set('Authorization', `Bearer ${token}`);
    expect(resposta.status).toBe(400);
  });

  test('rejeita status de filtro inválido', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .get('/api/leads?status=lixo')
      .set('Authorization', `Bearer ${token}`);

    expect(resposta.status).toBe(400);
  });

  test('paginação retorna envelope com metadados', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    for (let i = 0; i < 3; i++) await criarLead(token, { nome: `Lead ${i}` });

    const resposta = await request(app)
      .get('/api/leads?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(resposta.body).toHaveProperty('dados');
    expect(resposta.body.dados).toHaveLength(2);
    expect(resposta.body.total).toBe(3);
    expect(resposta.body.totalPaginas).toBe(2);
  });

  test('ordena mais recentes primeiro mesmo com timestamps iguais', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const respostas = await Promise.all([
      criarLead(token, { nome: 'Lote 1' }),
      criarLead(token, { nome: 'Lote 2' }),
      criarLead(token, { nome: 'Lote 3' }),
    ]);
    const idsCriados = respostas.map((r) => r.body.id).sort((a, b) => b - a);

    const resposta = await request(app).get('/api/leads').set('Authorization', `Bearer ${token}`);
    const idsRetornados = resposta.body.map((l) => l.id);

    expect(idsRetornados).toEqual(idsCriados);
  });
});

describe('GET /api/leads/:id', () => {
  test('retorna o lead quando ele pertence ao usuário', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token, { nome: 'Lead próprio' });

    const resposta = await request(app)
      .get(`/api/leads/${lead.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.nome).toBe('Lead próprio');
  });

  test('retorna 404 ao buscar lead de outro usuário', async () => {
    const userA = await criarUsuarioEToken(app, request);
    const userB = await criarUsuarioEToken(app, request);

    const leadA = await criarLead(userA.token, { nome: 'Lead privado' });

    const resposta = await request(app)
      .get(`/api/leads/${leadA.body.id}`)
      .set('Authorization', `Bearer ${userB.token}`);

    expect(resposta.status).toBe(404);
  });
});

describe('GET /api/leads/inbox', () => {
  test('lista leads do usuário com a última mensagem anexada', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token, { nome: 'Lead com conversa' });

    await request(app)
      .post(`/api/leads/${lead.body.id}/mensagens`)
      .set('Authorization', `Bearer ${token}`)
      .send({ conteudo: 'Oi, tudo bem?', enviado_por: 'humano' });

    const resposta = await request(app).get('/api/leads/inbox').set('Authorization', `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    const item = resposta.body.find((l) => l.id === lead.body.id);
    expect(item.ultima_mensagem).toBe('Oi, tudo bem?');
  });

  test('não mistura leads de outro usuário', async () => {
    const { token: tokenA } = await criarUsuarioEToken(app, request);
    const { token: tokenB } = await criarUsuarioEToken(app, request);
    await criarLead(tokenA, { nome: 'Lead de A' });

    const resposta = await request(app).get('/api/leads/inbox').set('Authorization', `Bearer ${tokenB}`);
    expect(resposta.body).toHaveLength(0);
  });

  test('exige token de autenticação', async () => {
    const resposta = await request(app).get('/api/leads/inbox');
    expect(resposta.status).toBe(401);
  });
});

describe('GET /api/leads/export', () => {
  test('exporta os leads do usuário em csv', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await criarLead(token, { nome: 'Fulano', servico: 'Implante', valor: 150 });

    const resposta = await request(app).get('/api/leads/export').set('Authorization', `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.headers['content-type']).toMatch(/text\/csv/);
    expect(resposta.headers['content-disposition']).toMatch(/leads\.csv/);
    expect(resposta.text).toContain('Fulano');
    expect(resposta.text).toContain('Implante');
  });

  test('respeita os mesmos filtros da listagem', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await criarLead(token, { nome: 'Lead Novo', status: 'novo' });
    await criarLead(token, { nome: 'Lead Fechado', status: 'fechado' });

    const resposta = await request(app)
      .get('/api/leads/export?status=fechado')
      .set('Authorization', `Bearer ${token}`);

    expect(resposta.text).toContain('Lead Fechado');
    expect(resposta.text).not.toContain('Lead Novo');
  });

  test('rejeita filtro inválido', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .get('/api/leads/export?status=status_invalido')
      .set('Authorization', `Bearer ${token}`);
    expect(resposta.status).toBe(400);
  });

  test('exige token de autenticação', async () => {
    const resposta = await request(app).get('/api/leads/export');
    expect(resposta.status).toBe(401);
  });
});

describe('PUT /api/leads/:id', () => {
  test('fechar lead seta fechado_em, reabrir limpa', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token, { nome: 'Negociação' });

    const fechado = await request(app)
      .put(`/api/leads/${lead.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'fechado', valor: 250 });
    expect(fechado.body.fechado_em).not.toBeNull();

    const reaberto = await request(app)
      .put(`/api/leads/${lead.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'em_contato' });
    expect(reaberto.body.fechado_em).toBeNull();
  });

  test('não permite atualizar lead de outro usuário', async () => {
    const userA = await criarUsuarioEToken(app, request);
    const userB = await criarUsuarioEToken(app, request);
    const lead = await criarLead(userA.token, { nome: 'Protegido' });

    const resposta = await request(app)
      .put(`/api/leads/${lead.body.id}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ nome: 'Hackeado' });

    expect(resposta.status).toBe(404);
  });

  test('rejeita status inválido na atualização', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token);

    const resposta = await request(app)
      .put(`/api/leads/${lead.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'status_invalido' });

    expect(resposta.status).toBe(400);
  });
});

describe('DELETE /api/leads/:id', () => {
  test('remove lead do próprio usuário', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token, { nome: 'Descartável' });

    const remover = await request(app)
      .delete(`/api/leads/${lead.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(remover.status).toBe(204);

    const buscar = await request(app)
      .get(`/api/leads/${lead.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(buscar.status).toBe(404);
  });

  test('não permite remover lead de outro usuário', async () => {
    const userA = await criarUsuarioEToken(app, request);
    const userB = await criarUsuarioEToken(app, request);
    const lead = await criarLead(userA.token, { nome: 'Protegido' });

    const resposta = await request(app)
      .delete(`/api/leads/${lead.body.id}`)
      .set('Authorization', `Bearer ${userB.token}`);

    expect(resposta.status).toBe(404);
  });
});

describe('Disparo de webhook ao criar/atualizar lead', () => {
  const ORIGINAL_FETCH = global.fetch;

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  // o disparo e fire-and-forget (nao bloqueia a resposta da API), entao o
  // teste precisa esperar a chamada acontecer em vez de assumir um tempo
  // fixo -- um sleep fixo e flaky (passa local, falha em CI mais lento).
  async function aguardarChamada(mockFn, tentativas = 40) {
    for (let i = 0; i < tentativas; i++) {
      if (mockFn.mock.calls.length > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  test('criar lead com integração ativa pra lead_criado dispara o webhook assinado', async () => {
    const { token } = await criarUsuarioEToken(app, request);

    await request(app)
      .post('/api/integracoes')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://exemplo.com/hook', eventos: ['lead_criado'] });

    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    await criarLead(token, { nome: 'Lead Webhook' });
    await aguardarChamada(global.fetch);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opcoes] = global.fetch.mock.calls[0];
    expect(url).toBe('https://exemplo.com/hook');
    expect(opcoes.headers['X-Zync-Signature']).toMatch(/^sha256=/);
    expect(JSON.parse(opcoes.body).evento).toBe('lead_criado');
  }, 10000);

  test('criar lead sem integração cadastrada não chama fetch', async () => {
    const { token } = await criarUsuarioEToken(app, request);

    global.fetch = jest.fn();
    await criarLead(token, { nome: 'Lead Sem Webhook' });
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(global.fetch).not.toHaveBeenCalled();
  }, 10000);
});
