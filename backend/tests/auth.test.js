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

  test('rejeita sem nome, email ou senha', async () => {
    const resposta = await request(app).post('/api/auth/register').send({ nome: 'Fulano' });
    expect(resposta.status).toBe(400);
  });

  test('rejeita nome acima de 120 caracteres', async () => {
    const resposta = await request(app).post('/api/auth/register').send({
      nome: 'a'.repeat(121),
      email: `nomegrande-${Date.now()}@zync.com`,
      senha: 'senha123',
    });
    expect(resposta.status).toBe(400);
  });

  test('rejeita email acima de 160 caracteres', async () => {
    const resposta = await request(app).post('/api/auth/register').send({
      nome: 'Fulano',
      email: `${'a'.repeat(155)}@zync.com`,
      senha: 'senha123',
    });
    expect(resposta.status).toBe(400);
  });

  test('vincula ao afiliado quando o codigoIndicacao é válido', async () => {
    const admin = await criarUsuarioEToken(app, request);
    await db.query('UPDATE usuarios SET is_admin = true WHERE id = $1', [admin.usuario.id]);
    const reloginAdmin = await request(app).post('/api/auth/login').send({ email: admin.email, senha: admin.senha });

    const indicador = await criarUsuarioEToken(app, request);
    const afiliado = await request(app)
      .post('/api/admin/afiliados')
      .set('Authorization', `Bearer ${reloginAdmin.body.token}`)
      .send({ email: indicador.email });

    const resposta = await request(app).post('/api/auth/register').send({
      nome: 'Indicado',
      email: `indicado-${Date.now()}@zync.com`,
      senha: 'senha123',
      codigoIndicacao: afiliado.body.codigo.toLowerCase(),
    });

    expect(resposta.status).toBe(201);
  });

  test('ignora codigoIndicacao inválido sem quebrar o cadastro', async () => {
    const resposta = await request(app).post('/api/auth/register').send({
      nome: 'Fulano',
      email: `comcodigo-${Date.now()}@zync.com`,
      senha: 'senha123',
      codigoIndicacao: 'NAOEXISTE',
    });
    expect(resposta.status).toBe(201);
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

  test('rejeita sem email ou senha', async () => {
    const resposta = await request(app).post('/api/auth/login').send({ email: 'so-email@zync.com' });
    expect(resposta.status).toBe(400);
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

  test('rejeita ia_horario_funcionamento maior que 200 caracteres', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ ia_horario_funcionamento: 'a'.repeat(201) });
    expect(resposta.status).toBe(400);
  });
});

describe('PUT /api/auth/me — nome, email e senha', () => {
  test('atualiza nome', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Novo Nome' });
    expect(resposta.status).toBe(200);
    expect(resposta.body.nome).toBe('Novo Nome');
  });

  test('rejeita nome vazio', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: '' });
    expect(resposta.status).toBe(400);
  });

  test('rejeita nome acima de 120 caracteres', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'a'.repeat(121) });
    expect(resposta.status).toBe(400);
  });

  test('atualiza email pra um novo email disponível', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const novoEmail = `novo-${Date.now()}@zync.com`;
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: novoEmail });
    expect(resposta.status).toBe(200);
    expect(resposta.body.email).toBe(novoEmail);
  });

  test('rejeita email inválido', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'nao-e-email' });
    expect(resposta.status).toBe(400);
  });

  test('rejeita email acima de 160 caracteres', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: `${'a'.repeat(155)}@zync.com` });
    expect(resposta.status).toBe(400);
  });

  test('rejeita email já usado por outra conta', async () => {
    const { email: emailA } = await criarUsuarioEToken(app, request);
    const { token: tokenB } = await criarUsuarioEToken(app, request);

    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ email: emailA });
    expect(resposta.status).toBe(409);
  });

  test('permite manter o próprio email', async () => {
    const { token, email } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ email });
    expect(resposta.status).toBe(200);
  });

  test('troca a senha com senha_atual correta', async () => {
    const { token, email } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ senha: 'novaSenha123', senha_atual: 'senha123' });
    expect(resposta.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({ email, senha: 'novaSenha123' });
    expect(login.status).toBe(200);
  });

  test('rejeita troca de senha sem senha_atual', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ senha: 'novaSenha123' });
    expect(resposta.status).toBe(400);
  });

  test('rejeita troca de senha com senha_atual incorreta', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ senha: 'novaSenha123', senha_atual: 'senhaErrada' });
    expect(resposta.status).toBe(401);
  });

  test('rejeita nova senha inválida', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ senha: 'curta', senha_atual: 'senha123' });
    expect(resposta.status).toBe(400);
  });
});

describe('PUT /api/auth/me — dados pessoais', () => {
  test('atualiza nome_empresa', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome_empresa: 'Studio Beleza & Cia' });
    expect(resposta.status).toBe(200);
    expect(resposta.body.nome_empresa).toBe('Studio Beleza & Cia');
  });

  test('rejeita nome_empresa acima de 120 caracteres', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome_empresa: 'a'.repeat(121) });
    expect(resposta.status).toBe(400);
  });

  test('rejeita idade inválida', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ idade: 200 });
    expect(resposta.status).toBe(400);
  });

  test('aceita idade null', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ idade: null });
    expect(resposta.status).toBe(200);
  });

  test('rejeita cpf inválido', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ cpf: '11111111111' });
    expect(resposta.status).toBe(400);
  });

  test('aceita cpf válido', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ cpf: '52998224725' });
    expect(resposta.status).toBe(200);
    expect(resposta.body.cpf).toBe('52998224725');
  });

  test('atualiza foto_url, instagram, facebook e telefone', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ foto_url: 'https://x.com/foto.png', instagram: '@zync', facebook: 'zync', telefone: '11999999999' });
    expect(resposta.status).toBe(200);
    expect(resposta.body.instagram).toBe('@zync');
  });
});

describe('PUT /api/auth/me — whatsapp_phone_number_id', () => {
  test('rejeita acima de 60 caracteres', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ whatsapp_phone_number_id: 'a'.repeat(61) });
    expect(resposta.status).toBe(400);
  });

  test('rejeita id já usado por outra conta', async () => {
    const { token: tokenA } = await criarUsuarioEToken(app, request);
    const { token: tokenB } = await criarUsuarioEToken(app, request);

    await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ whatsapp_phone_number_id: '1234567890' });

    const resposta = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ whatsapp_phone_number_id: '1234567890' });
    expect(resposta.status).toBe(409);
  });

  test('aceita definir e depois limpar o id (null)', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const definir = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ whatsapp_phone_number_id: '999888777' });
    expect(definir.status).toBe(200);

    const limpar = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ whatsapp_phone_number_id: '' });
    expect(limpar.status).toBe(200);
    expect(limpar.body.whatsapp_phone_number_id).toBeNull();
  });
});

describe('POST /api/auth/logout-everywhere', () => {
  test('invalida o token atual, exigindo novo login', async () => {
    const { token, email, senha } = await criarUsuarioEToken(app, request);

    // pwdTs no token tem granularidade de segundo - espera passar pra outro
    // segundo antes de invalidar, senão o "antes" e o "depois" podem cair no
    // mesmo segundo e o token antigo pareceria continuar válido.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const logout = await request(app)
      .post('/api/auth/logout-everywhere')
      .set('Authorization', `Bearer ${token}`);
    expect(logout.status).toBe(200);

    const comTokenAntigo = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(comTokenAntigo.status).toBe(401);

    const relogin = await request(app).post('/api/auth/login').send({ email, senha });
    expect(relogin.status).toBe(200);

    const comTokenNovo = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${relogin.body.token}`);
    expect(comTokenNovo.status).toBe(200);
  });

  test('rejeita sem autenticação', async () => {
    const resposta = await request(app).post('/api/auth/logout-everywhere');
    expect(resposta.status).toBe(401);
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

  test('rejeita sem token ou novaSenha', async () => {
    const resposta = await request(app).post('/api/auth/redefinir-senha').send({ token: 'qualquer' });
    expect(resposta.status).toBe(400);
  });

  test('rejeita novaSenha inválida mesmo com token válido', async () => {
    const { email } = await criarUsuarioEToken(app, request);
    await request(app).post('/api/auth/esqueci-senha').send({ email });
    const corpoEnviado = emailService.enviarEmail.mock.calls.at(-1)[2];
    const token = corpoEnviado.match(/token=([a-f0-9]+)/)[1];

    const resposta = await request(app)
      .post('/api/auth/redefinir-senha')
      .send({ token, novaSenha: 'curta' });
    expect(resposta.status).toBe(400);
  });
});
