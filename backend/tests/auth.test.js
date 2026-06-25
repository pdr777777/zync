const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const emailService = require('../src/services/emailService');
const { criarUsuarioEToken } = require('./helpers');

jest.mock('../src/services/emailService');

afterAll(async () => {
  await db.end();
});

describe('POST /api/auth/register', () => {
  test('cria usuário com dados válidos', async () => {
    const resposta = await request(app).post('/api/auth/register').send({
      nome: 'Fulano',
      email: `fulano-${Date.now()}@zync.com`,
      senha: 'senha123',
    });

    expect(resposta.status).toBe(201);
    expect(resposta.body).toHaveProperty('id');
    expect(resposta.body).not.toHaveProperty('senha_hash');
  });

  test('rejeita email duplicado', async () => {
    const email = `duplicado-${Date.now()}@zync.com`;
    await request(app).post('/api/auth/register').send({ nome: 'A', email, senha: 'senha123' });

    const resposta = await request(app).post('/api/auth/register').send({ nome: 'B', email, senha: 'senha123' });

    expect(resposta.status).toBe(409);
  });

  test('rejeita email inválido', async () => {
    const resposta = await request(app).post('/api/auth/register').send({
      nome: 'Fulano',
      email: 'nao-e-email',
      senha: 'senha123',
    });

    expect(resposta.status).toBe(400);
  });

  test('rejeita senha curta', async () => {
    const resposta = await request(app).post('/api/auth/register').send({
      nome: 'Fulano',
      email: `curta-${Date.now()}@zync.com`,
      senha: '123',
    });

    expect(resposta.status).toBe(400);
  });

  test('rejeita senha só com letras', async () => {
    const resposta = await request(app).post('/api/auth/register').send({
      nome: 'Fulano',
      email: `soletras-${Date.now()}@zync.com`,
      senha: 'somenteletras',
    });

    expect(resposta.status).toBe(400);
  });

  test('rejeita senha só com números', async () => {
    const resposta = await request(app).post('/api/auth/register').send({
      nome: 'Fulano',
      email: `sonumeros-${Date.now()}@zync.com`,
      senha: '12345678',
    });

    expect(resposta.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  test('autentica com credenciais corretas', async () => {
    const { email, senha } = await criarUsuarioEToken(app, request);
    const resposta = await request(app).post('/api/auth/login').send({ email, senha });

    expect(resposta.status).toBe(200);
    expect(resposta.body).toHaveProperty('token');
    expect(resposta.body.usuario).toHaveProperty('email', email);
  });

  test('rejeita senha errada', async () => {
    const { email } = await criarUsuarioEToken(app, request);
    const resposta = await request(app).post('/api/auth/login').send({ email, senha: 'senhaErrada' });

    expect(resposta.status).toBe(401);
  });

  test('rejeita email inexistente', async () => {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inexistente@zync.com', senha: 'qualquer123' });

    expect(resposta.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  test('retorna 401 sem token', async () => {
    const resposta = await request(app).get('/api/auth/me');
    expect(resposta.status).toBe(401);
  });

  test('retorna dados do usuário autenticado', async () => {
    const { token, email } = await criarUsuarioEToken(app, request);
    const resposta = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.email).toBe(email);
  });
});

describe('PUT /api/auth/me — configuração da IA de atendimento', () => {
  test('salva o que vende, horário e tom de voz', async () => {
    const { token } = await criarUsuarioEToken(app, request);

    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ia_o_que_vende: 'Limpeza de pele e design de sobrancelha',
        ia_horario_funcionamento: 'Seg a sáb, 9h às 19h',
        ia_tom_de_voz: 'casual',
      });

    expect(resposta.status).toBe(200);
    expect(resposta.body.ia_o_que_vende).toBe('Limpeza de pele e design de sobrancelha');
    expect(resposta.body.ia_horario_funcionamento).toBe('Seg a sáb, 9h às 19h');
    expect(resposta.body.ia_tom_de_voz).toBe('casual');
  });

  test('rejeita tom de voz fora da lista permitida', async () => {
    const { token } = await criarUsuarioEToken(app, request);

    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ ia_tom_de_voz: 'engracado' });

    expect(resposta.status).toBe(400);
  });

  test('rejeita ia_o_que_vende maior que 2000 caracteres', async () => {
    const { token } = await criarUsuarioEToken(app, request);

    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ ia_o_que_vende: 'a'.repeat(2001) });

    expect(resposta.status).toBe(400);
  });
});

describe('Fluxo de reset de senha', () => {
  test('esqueci-senha responde igual pra email existente e inexistente', async () => {
    const { email } = await criarUsuarioEToken(app, request);

    const respostaExistente = await request(app).post('/api/auth/esqueci-senha').send({ email });
    const respostaInexistente = await request(app)
      .post('/api/auth/esqueci-senha')
      .send({ email: 'nunca-existiu@zync.com' });

    expect(respostaExistente.status).toBe(200);
    expect(respostaInexistente.status).toBe(200);
    expect(respostaExistente.body.mensagem).toBe(respostaInexistente.body.mensagem);
  });

  test('redefine a senha com token válido e bloqueia reuso', async () => {
    const { email } = await criarUsuarioEToken(app, request);

    await request(app).post('/api/auth/esqueci-senha').send({ email });

    const corpoEnviado = emailService.enviarEmail.mock.calls.at(-1)[2];
    const token = corpoEnviado.match(/token=([a-f0-9]+)/)[1];

    const redefinir = await request(app)
      .post('/api/auth/redefinir-senha')
      .send({ token, novaSenha: 'novaSenha123' });
    expect(redefinir.status).toBe(200);

    const loginComNova = await request(app).post('/api/auth/login').send({ email, senha: 'novaSenha123' });
    expect(loginComNova.status).toBe(200);

    const reuso = await request(app)
      .post('/api/auth/redefinir-senha')
      .send({ token, novaSenha: 'outraSenha456' });
    expect(reuso.status).toBe(400);
  });

  test('rejeita token inválido', async () => {
    const resposta = await request(app)
      .post('/api/auth/redefinir-senha')
      .send({ token: 'token-invalido', novaSenha: 'senha123' });

    expect(resposta.status).toBe(400);
  });
});
