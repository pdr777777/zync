const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');

afterAll(async () => {
  await db.end();
});

describe('GET /health', () => {
  test('retorna ok quando o banco está acessível', async () => {
    const resposta = await request(app).get('/health');

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ status: 'ok' });
  });
});
