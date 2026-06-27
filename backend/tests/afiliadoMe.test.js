const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { criarUsuarioEToken } = require('./helpers');

afterAll(async () => {
  await db.end();
});

async function criarAdmin() {
  const usuarioComToken = await criarUsuarioEToken(app, request);
  await db.query('UPDATE usuarios SET is_admin = true WHERE id = $1', [usuarioComToken.usuario.id]);

  const relogin = await request(app)
    .post('/api/auth/login')
    .send({ email: usuarioComToken.email, senha: usuarioComToken.senha });

  return { ...usuarioComToken, token: relogin.body.token };
}

async function tornarAfiliado(adminToken, email, percentualComissao) {
  return request(app)
    .post('/api/admin/afiliados')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email, percentualComissao });
}

describe('GET /api/afiliados/me', () => {
  test('retorna null quando o usuário não é afiliado', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app).get('/api/afiliados/me').set('Authorization', `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toBeNull();
  });

  test('retorna o próprio código e percentual quando é afiliado', async () => {
    const admin = await criarAdmin();
    const { token, email } = await criarUsuarioEToken(app, request);
    await tornarAfiliado(admin.token, email, 15);

    const resposta = await request(app).get('/api/afiliados/me').set('Authorization', `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.percentual_comissao).toBe('15.00');
    expect(resposta.body.codigo).toMatch(/^[0-9A-F]{8}$/);
    expect(resposta.body.ativo).toBe(true);
  });

  test('não revela o afiliado de outro usuário', async () => {
    const admin = await criarAdmin();
    const { email: emailA } = await criarUsuarioEToken(app, request);
    const { token: tokenB } = await criarUsuarioEToken(app, request);
    await tornarAfiliado(admin.token, emailA);

    const resposta = await request(app).get('/api/afiliados/me').set('Authorization', `Bearer ${tokenB}`);
    expect(resposta.body).toBeNull();
  });

  test('rejeita sem autenticação', async () => {
    const resposta = await request(app).get('/api/afiliados/me');
    expect(resposta.status).toBe(401);
  });
});

describe('GET /api/afiliados/me/comissoes', () => {
  test('retorna lista vazia quando não é afiliado', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app).get('/api/afiliados/me/comissoes').set('Authorization', `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual([]);
  });

  test('retorna lista vazia quando é afiliado mas ainda não tem indicação', async () => {
    const admin = await criarAdmin();
    const { token, email } = await criarUsuarioEToken(app, request);
    await tornarAfiliado(admin.token, email);

    const resposta = await request(app).get('/api/afiliados/me/comissoes').set('Authorization', `Bearer ${token}`);
    expect(resposta.body).toEqual([]);
  });

  test('rejeita sem autenticação', async () => {
    const resposta = await request(app).get('/api/afiliados/me/comissoes');
    expect(resposta.status).toBe(401);
  });
});
