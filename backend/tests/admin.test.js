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

describe('Controle de acesso do admin', () => {
  test('usuário comum recebe 403 em todas as rotas de admin', async () => {
    const { token } = await criarUsuarioEToken(app, request);

    const rotas = [
      ['get', '/api/admin/usuarios'],
      ['get', '/api/admin/metricas'],
      ['get', '/api/admin/planos'],
      ['get', '/api/admin/afiliados'],
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
  test('rejeita isAdmin que não seja booleano', async () => {
    const admin = await criarAdmin();
    const { usuario } = await criarUsuarioEToken(app, request);

    const resposta = await request(app)
      .patch(`/api/admin/usuarios/${usuario.id}/admin`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isAdmin: 'sim' });
    expect(resposta.status).toBe(400);
  });

  test('rejeita usuário inexistente', async () => {
    const admin = await criarAdmin();
    const resposta = await request(app)
      .patch('/api/admin/usuarios/999999/admin')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isAdmin: true });
    expect(resposta.status).toBe(404);
  });

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

    const { rows: planoRows } = await db.query(
      "INSERT INTO planos (nome, preco, intervalo_dias) VALUES ('Plano Teste MRR', 300, 90) RETURNING id"
    );

    await db.query(
      `INSERT INTO assinaturas (usuario_id, plano_id, status, valor, syncpay_identifier)
       VALUES ($1, $2, 'ativa', 300, $3)`,
      [usuario.id, planoRows[0].id, `mrr-test-${Date.now()}`]
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
    expect(desativar.body.ativo).toBe(false);

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

  test('rejeita sem nome ou preco ao criar plano', async () => {
    const admin = await criarAdmin();
    const resposta = await request(app)
      .post('/api/admin/planos')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ nome: 'Sem preço' });
    expect(resposta.status).toBe(400);
  });

  test('rejeita intervaloDias inválido ao criar plano', async () => {
    const admin = await criarAdmin();
    const resposta = await request(app)
      .post('/api/admin/planos')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ nome: 'Plano Ruim', preco: 50, intervaloDias: -5 });
    expect(resposta.status).toBe(400);
  });

  test('rejeita plano inexistente ao atualizar', async () => {
    const admin = await criarAdmin();
    const resposta = await request(app)
      .put('/api/admin/planos/999999')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ativo: false });
    expect(resposta.status).toBe(404);
  });

  test('rejeita preco inválido ao atualizar plano', async () => {
    const admin = await criarAdmin();
    const criar = await request(app)
      .post('/api/admin/planos')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ nome: 'Plano X', preco: 50 });

    const resposta = await request(app)
      .put(`/api/admin/planos/${criar.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ preco: -1 });
    expect(resposta.status).toBe(400);
  });

  test('rejeita intervaloDias inválido ao atualizar plano', async () => {
    const admin = await criarAdmin();
    const criar = await request(app)
      .post('/api/admin/planos')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ nome: 'Plano Y', preco: 50 });

    const resposta = await request(app)
      .put(`/api/admin/planos/${criar.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ intervaloDias: 0 });
    expect(resposta.status).toBe(400);
  });
});

describe('PATCH /api/admin/usuarios/:id/remover e /reativar', () => {
  test('rejeita usuário inexistente', async () => {
    const admin = await criarAdmin();
    const remover = await request(app)
      .patch('/api/admin/usuarios/999999/remover')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(remover.status).toBe(404);

    const reativar = await request(app)
      .patch('/api/admin/usuarios/999999/reativar')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(reativar.status).toBe(404);
  });

  test('admin não pode remover a própria conta', async () => {
    const admin = await criarAdmin();
    const resposta = await request(app)
      .patch(`/api/admin/usuarios/${admin.usuario.id}/remover`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(resposta.status).toBe(400);
  });

  test('remove e reativa uma empresa', async () => {
    const admin = await criarAdmin();
    const { usuario } = await criarUsuarioEToken(app, request);

    const remover = await request(app)
      .patch(`/api/admin/usuarios/${usuario.id}/remover`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(remover.status).toBe(204);

    const semRemovidas = await request(app)
      .get('/api/admin/usuarios')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(semRemovidas.body.find((u) => u.id === usuario.id)).toBeUndefined();

    const comRemovidas = await request(app)
      .get('/api/admin/usuarios?incluirRemovidos=true')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(comRemovidas.body.find((u) => u.id === usuario.id)).toBeDefined();

    const reativar = await request(app)
      .patch(`/api/admin/usuarios/${usuario.id}/reativar`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(reativar.status).toBe(204);

    const depoisDeReativar = await request(app)
      .get('/api/admin/usuarios')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(depoisDeReativar.body.find((u) => u.id === usuario.id)).toBeDefined();
  });
});

describe('PATCH /api/admin/usuarios/:id/assinatura/cancelar', () => {
  test('rejeita quando não há assinatura ativa', async () => {
    const admin = await criarAdmin();
    const { usuario } = await criarUsuarioEToken(app, request);

    const resposta = await request(app)
      .patch(`/api/admin/usuarios/${usuario.id}/assinatura/cancelar`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(resposta.status).toBe(400);
  });

  test('cancela a assinatura ativa de uma empresa', async () => {
    const admin = await criarAdmin();
    const { usuario, token } = await criarUsuarioEToken(app, request);

    const { rows: planoRows } = await db.query(
      "INSERT INTO planos (nome, preco, intervalo_dias) VALUES ('Plano Cancelar Admin', 80, 30) RETURNING id"
    );
    await db.query(
      `INSERT INTO assinaturas (usuario_id, plano_id, status, valor, syncpay_identifier)
       VALUES ($1, $2, 'ativa', 80, $3)`,
      [usuario.id, planoRows[0].id, `cancelar-admin-${Date.now()}`]
    );

    const resposta = await request(app)
      .patch(`/api/admin/usuarios/${usuario.id}/assinatura/cancelar`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(resposta.status).toBe(204);

    const atual = await request(app)
      .get('/api/assinaturas/atual')
      .set('Authorization', `Bearer ${token}`);
    expect(atual.body.status).toBe('cancelada');
  });
});

describe('Suporte via admin', () => {
  test('lista mensagens de suporte de todos os usuários e marca como respondida', async () => {
    const admin = await criarAdmin();
    const { token } = await criarUsuarioEToken(app, request);

    const criada = await request(app)
      .post('/api/suporte')
      .set('Authorization', `Bearer ${token}`)
      .send({ mensagem: 'Preciso de ajuda' });

    const lista = await request(app).get('/api/admin/suporte').set('Authorization', `Bearer ${admin.token}`);
    expect(lista.status).toBe(200);
    expect(lista.body.find((m) => m.id === criada.body.id)).toBeDefined();

    const responder = await request(app)
      .patch(`/api/admin/suporte/${criada.body.id}/respondida`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(responder.status).toBe(204);

    const listaDepois = await request(app).get('/api/admin/suporte').set('Authorization', `Bearer ${admin.token}`);
    expect(listaDepois.body.find((m) => m.id === criada.body.id).respondida).toBe(true);
  });

  test('rejeita marcar como respondida mensagem inexistente', async () => {
    const admin = await criarAdmin();
    const resposta = await request(app)
      .patch('/api/admin/suporte/999999/respondida')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(resposta.status).toBe(404);
  });
});

describe('PUT /api/admin/afiliados/:id — validação', () => {
  test('rejeita afiliado inexistente', async () => {
    const admin = await criarAdmin();
    const resposta = await request(app)
      .put('/api/admin/afiliados/999999')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ativo: false });
    expect(resposta.status).toBe(404);
  });

  test('rejeita percentual_comissao fora de 0-100', async () => {
    const admin = await criarAdmin();
    const { email } = await criarUsuarioEToken(app, request);

    const afiliado = await request(app)
      .post('/api/admin/afiliados')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email });

    const resposta = await request(app)
      .put(`/api/admin/afiliados/${afiliado.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ percentual_comissao: 150 });
    expect(resposta.status).toBe(400);
  });
});
