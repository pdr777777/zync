const request = require('supertest');

process.env.FRONTEND_URL = 'https://app-a.vercel.app, https://app-b.vercel.app';

const app = require('../src/app');
const db = require('../src/config/db');

afterAll(async () => {
  await db.end();
});

describe('CORS com múltiplas origens em FRONTEND_URL', () => {
  test('libera a primeira origem da lista', async () => {
    const resposta = await request(app).get('/health').set('Origin', 'https://app-a.vercel.app');
    expect(resposta.headers['access-control-allow-origin']).toBe('https://app-a.vercel.app');
  });

  test('libera a segunda origem da lista', async () => {
    const resposta = await request(app).get('/health').set('Origin', 'https://app-b.vercel.app');
    expect(resposta.headers['access-control-allow-origin']).toBe('https://app-b.vercel.app');
  });

  test('bloqueia origem fora da lista', async () => {
    const resposta = await request(app).get('/health').set('Origin', 'https://nao-autorizado.com');
    expect(resposta.status).toBe(403);
  });

  test('libera localhost:5500 mesmo sem estar em FRONTEND_URL', async () => {
    const resposta = await request(app).get('/health').set('Origin', 'http://localhost:5500');
    expect(resposta.headers['access-control-allow-origin']).toBe('http://localhost:5500');
  });
});
