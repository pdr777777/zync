const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const leadModel = require('../src/models/leadModel');
const { criarUsuarioEToken } = require('./helpers');

afterAll(async () => {
  await db.end();
});

function importar(token, csv) {
  return request(app)
    .post('/api/leads/importar')
    .set('Authorization', `Bearer ${token}`)
    .send({ csv });
}

describe('POST /api/leads/importar', () => {
  test('importa leads validos do csv e dispara webhook pra cada um', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const csv = 'nome,telefone,servico,origem,valor\nFulano,11999999999,Implante,instagram,150\nCiclano,11888888888,,,';

    const resposta = await importar(token, csv);

    expect(resposta.status).toBe(201);
    expect(resposta.body).toEqual({ importados: 2, erros: [] });

    const leads = await request(app).get('/api/leads').set('Authorization', `Bearer ${token}`);
    expect(leads.body).toHaveLength(2);
    expect(leads.body.some((l) => l.nome === 'Fulano' && l.servico === 'Implante')).toBe(true);
  });

  test('reporta erro por linha sem travar a importação inteira', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const csv = 'nome,status,valor\nFulano,novo,100\n,novo,100\nCiclano,status_invalido,100';

    const resposta = await importar(token, csv);

    expect(resposta.status).toBe(201);
    expect(resposta.body.importados).toBe(1);
    expect(resposta.body.erros).toEqual([
      { linha: 3, motivo: 'nome é obrigatório' },
      { linha: 4, motivo: expect.stringContaining('status deve ser') },
    ]);
  });

  test('quando todas as linhas falham, importados fica zero e nao quebra', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await importar(token, 'nome,status\n,novo\n,novo');

    expect(resposta.status).toBe(201);
    expect(resposta.body.importados).toBe(0);
    expect(resposta.body.erros).toHaveLength(2);
  });

  test('rejeita sem csv', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await importar(token, '');
    expect(resposta.status).toBe(400);
  });

  test('rejeita csv sem linhas de dados (só cabeçalho)', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await importar(token, 'nome,telefone');
    expect(resposta.status).toBe(400);
  });

  test('rejeita csv com mais de 1000 linhas', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const linhas = Array.from({ length: 1001 }, (_, i) => `Lead ${i}`).join('\n');
    const resposta = await importar(token, `nome\n${linhas}`);
    expect(resposta.status).toBe(400);
  });

  test('leads importados pertencem só a quem importou', async () => {
    const { token: tokenA } = await criarUsuarioEToken(app, request);
    const { token: tokenB } = await criarUsuarioEToken(app, request);

    await importar(tokenA, 'nome\nLead da empresa A');

    const leadsB = await request(app).get('/api/leads').set('Authorization', `Bearer ${tokenB}`);
    expect(leadsB.body).toHaveLength(0);
  });

  test('reporta erro de banco numa linha sem travar a importação das demais', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const spy = jest.spyOn(leadModel, 'criar').mockRejectedValueOnce(new Error('erro de banco simulado'));

    const resposta = await importar(token, 'nome\nFulano\nCiclano');

    expect(resposta.status).toBe(201);
    expect(resposta.body.importados).toBe(1);
    expect(resposta.body.erros).toEqual([{ linha: 2, motivo: 'erro de banco simulado' }]);

    spy.mockRestore();
  });

  test('rejeita sem autenticação', async () => {
    const resposta = await request(app).post('/api/leads/importar').send({ csv: 'nome\nFulano' });
    expect(resposta.status).toBe(401);
  });
});
