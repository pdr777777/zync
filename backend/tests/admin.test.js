const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { criarUsuarioEToken } = require('./helpers');

afterAll(async () => {
  await db.end();
});

async function criarAdmin() {
  const usuarioComToken = await criarUsuarioEToken(app, request);
  await db.query('UPDATE usuarios SET is_admin = 1 WHERE id = ?', [usuarioComToken.usuario.id]);

  const relogin = await request(app)
    .post('/api/auth/login')
    .send({ email: usuarioComToken.email, senha: usuarioComToken.senha });

  return { ...usuarioComToken, token: relogin.body.token };
}

describe('Controle de acesso do admin', () => {
  test('usuário comum recebe 403 em todas as rotas de admin', async () => {
    const { token } = await criarUsuarioEToken(app, request);

    const rotas = [
      ['get', '/api/admin/usuarios'],
      ['get', '/api/admin/metricas'],
      ['get', '/api/admin/planos'],
    ];

    for (const [metodo, rota] of rotas) {
      const resposta = await request(app)[metodo](rota).set('Authorization', `Bearer ${token}`);
      expect(resposta.status).toBe(403);
    }
  });

  test('admin acessa normalmente', async () => {
    const { token } = await criarAdmin();
    const resposta = await request(app).get('/api/admin/usuarios').set('Authorization', `Bearer ${token}`);
    expect(resposta.status).toBe(200);
  });
});

describe('GET /api/admin/usuarios', () => {
  test('lista inclui o usuário recém-criado com seus dados', async () => {
    const admin = await criarAdmin();
    const outro = await criarUsuarioEToken(app, request);

    const resposta = await request(app)
      .get('/api/admin/usuarios')
      .set('Authorization', `Bearer ${admin.token}`);

    const encontrado = resposta.body.find((u) => u.email === outro.email);
    expect(encontrado).toBeDefined();
    expect(encontrado.assinatura_status).toBeNull();
  });
});

describe('PATCH /api/admin/usuarios/:id/admin', () => {
  test('concede e revoga acesso de admin a outra conta', async () => {
    const admin = await criarAdmin();
    const outro = await criarUsuarioEToken(app, request);

    const conceder = await request(app)
      .patch(`/api/admin/usuarios/${outro.usuario.id}/admin`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isAdmin: true });
    expect(conceder.status).toBe(200);

    const revogar = await request(app)
      .patch(`/api/admin/usuarios/${outro.usuario.id}/admin`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isAdmin: false });
    expect(revogar.status).toBe(200);
  });

  test('impede que o admin revogue o próprio acesso', async () => {
    const admin = await criarAdmin();

    const resposta = await request(app)
      .patch(`/api/admin/usuarios/${admin.usuario.id}/admin`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isAdmin: false });

    expect(resposta.status).toBe(400);
  });
});

describe('GET /api/admin/metricas', () => {
  test('mrr aumenta proporcionalmente ao normalizar plano trimestral', async () => {
    const admin = await criarAdmin();

    const antes = await request(app)
      .get('/api/admin/metricas')
      .set('Authorization', `Bearer ${admin.token}`);

    const { usuario } = await criarUsuarioEToken(app, request);

    const [planoResult] = await db.query(
      "INSERT INTO planos (nome, preco, intervalo_dias) VALUES ('Plano Teste MRR', 300, 90)"
    );

    await db.query(
      `INSERT INTO assinaturas (usuario_id, plano_id, status, valor, syncpay_identifier)
       VALUES (?, ?, 'ativa', 300, ?)`,
      [usuario.id, planoResult.insertId, `mrr-test-${Date.now()}`]
    );

    const depois = await request(app)
      .get('/api/admin/metricas')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(depois.body.mrr - antes.body.mrr).toBeCloseTo(100, 2);
    expect(depois.body.totalUsuarios).toBeGreaterThan(antes.body.totalUsuarios);
  });
});

describe('Planos via admin', () => {
  test('cria, lista (incluindo inativos) e atualiza um plano', async () => {
    const admin = await criarAdmin();

    const criar = await request(app)
      .post('/api/admin/planos')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ nome: 'Plano Admin Teste', preco: 123.45, intervaloDias: 30 });
    expect(criar.status).toBe(201);

    const desativar = await request(app)
      .put(`/api/admin/planos/${criar.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ativo: false });
    expect(desativar.status).toBe(200);
    expect(desativar.body.ativo).toBe(0);

    const listarTodos = await request(app)
      .get('/api/admin/planos')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(listarTodos.body.find((p) => p.id === criar.body.id)).toBeDefined();

    const listarPublico = await request(app)
      .get('/api/planos')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(listarPublico.body.find((p) => p.id === criar.body.id)).toBeUndefined();
  });

  test('rejeita preco inválido ao criar plano', async () => {
    const admin = await criarAdmin();
    const resposta = await request(app)
      .post('/api/admin/planos')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ nome: 'Plano Ruim', preco: -10 });
    expect(resposta.status).toBe(400);
  });
});
