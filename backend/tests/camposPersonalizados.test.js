const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { criarUsuarioEToken } = require('./helpers');

afterAll(async () => {
  await db.end();
});

async function criarLead(token, nome = 'Lead com campo') {
  const resposta = await request(app)
    .post('/api/leads')
    .set('Authorization', `Bearer ${token}`)
    .send({ nome });
  return resposta.body;
}

async function criarCampo(token, dados) {
  const resposta = await request(app)
    .post('/api/campos-personalizados')
    .set('Authorization', `Bearer ${token}`)
    .send(dados);
  return resposta;
}

describe('Campos personalizados (definição)', () => {
  test('cria, lista e remove um campo', async () => {
    const { token } = await criarUsuarioEToken(app, request);

    const criado = await criarCampo(token, { nome: 'Convênio', tipo: 'texto' });
    expect(criado.status).toBe(201);
    expect(criado.body.nome).toBe('Convênio');
    expect(criado.body.tipo).toBe('texto');

    const lista = await request(app).get('/api/campos-personalizados').set('Authorization', `Bearer ${token}`);
    expect(lista.body).toHaveLength(1);

    const removido = await request(app)
      .delete(`/api/campos-personalizados/${criado.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(removido.status).toBe(204);

    const listaDepois = await request(app).get('/api/campos-personalizados').set('Authorization', `Bearer ${token}`);
    expect(listaDepois.body).toHaveLength(0);
  });

  test('rejeita sem nome', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await criarCampo(token, { tipo: 'texto' });
    expect(resposta.status).toBe(400);
  });

  test('rejeita tipo inválido', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await criarCampo(token, { nome: 'Campo X', tipo: 'invalido' });
    expect(resposta.status).toBe(400);
  });

  test('rejeita selecao sem opcoes', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await criarCampo(token, { nome: 'Plano', tipo: 'selecao' });
    expect(resposta.status).toBe(400);
  });

  test('cria campo selecao com opcoes', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const resposta = await criarCampo(token, { nome: 'Plano', tipo: 'selecao', opcoes: ['Básico', 'Pro'] });
    expect(resposta.status).toBe(201);
    expect(resposta.body.opcoes).toEqual(['Básico', 'Pro']);
  });

  test('rejeita nome duplicado para o mesmo usuário', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    await criarCampo(token, { nome: 'Repetido', tipo: 'texto' });
    const resposta = await criarCampo(token, { nome: 'Repetido', tipo: 'numero' });
    expect(resposta.status).toBe(409);
  });

  test('404 em campo de outro usuário', async () => {
    const { token: tokenA } = await criarUsuarioEToken(app, request);
    const { token: tokenB } = await criarUsuarioEToken(app, request);
    const campo = await criarCampo(tokenA, { nome: 'Privado', tipo: 'texto' });

    const resposta = await request(app)
      .delete(`/api/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resposta.status).toBe(404);
  });

  test('rejeita sem autenticação', async () => {
    const resposta = await request(app).get('/api/campos-personalizados');
    expect(resposta.status).toBe(401);
  });

  test('atualiza o nome do campo', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const campo = await criarCampo(token, { nome: 'Nome Antigo', tipo: 'texto' });

    const resposta = await request(app)
      .patch(`/api/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Nome Novo' });
    expect(resposta.status).toBe(200);
    expect(resposta.body.nome).toBe('Nome Novo');
  });

  test('atualiza as opcoes de um campo selecao', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const campo = await criarCampo(token, { nome: 'Plano', tipo: 'selecao', opcoes: ['Básico'] });

    const resposta = await request(app)
      .patch(`/api/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ opcoes: ['Básico', 'Pro', 'Enterprise'] });
    expect(resposta.status).toBe(200);
    expect(resposta.body.opcoes).toEqual(['Básico', 'Pro', 'Enterprise']);
  });

  test('rejeita atualizar opcoes em campo que não é selecao', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const campo = await criarCampo(token, { nome: 'Convênio', tipo: 'texto' });

    const resposta = await request(app)
      .patch(`/api/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ opcoes: ['A', 'B'] });
    expect(resposta.status).toBe(400);
  });

  test('404 ao atualizar campo de outro usuário', async () => {
    const { token: tokenA } = await criarUsuarioEToken(app, request);
    const { token: tokenB } = await criarUsuarioEToken(app, request);
    const campo = await criarCampo(tokenA, { nome: 'Privado', tipo: 'texto' });

    const resposta = await request(app)
      .patch(`/api/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ nome: 'Hackeado' });
    expect(resposta.status).toBe(404);
  });
});

describe('Valores de campos personalizados por lead', () => {
  test('lista campo mesmo sem valor ainda, grava e sobrescreve valor', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token);
    const campo = await criarCampo(token, { nome: 'Tamanho', tipo: 'texto' });

    const listaInicial = await request(app)
      .get(`/api/leads/${lead.id}/campos-personalizados`)
      .set('Authorization', `Bearer ${token}`);
    expect(listaInicial.body).toHaveLength(1);
    expect(listaInicial.body[0].valor).toBeNull();

    const definir = await request(app)
      .put(`/api/leads/${lead.id}/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: 'M' });
    expect(definir.status).toBe(200);

    const listaDepois = await request(app)
      .get(`/api/leads/${lead.id}/campos-personalizados`)
      .set('Authorization', `Bearer ${token}`);
    expect(listaDepois.body[0].valor).toBe('M');

    const sobrescrever = await request(app)
      .put(`/api/leads/${lead.id}/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: 'G' });
    expect(sobrescrever.status).toBe(200);

    const listaFinal = await request(app)
      .get(`/api/leads/${lead.id}/campos-personalizados`)
      .set('Authorization', `Bearer ${token}`);
    expect(listaFinal.body[0].valor).toBe('G');
  });

  test('rejeita valor não-numérico para campo numero', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token);
    const campo = await criarCampo(token, { nome: 'Idade', tipo: 'numero' });

    const resposta = await request(app)
      .put(`/api/leads/${lead.id}/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: 'abc' });
    expect(resposta.status).toBe(400);
  });

  test('rejeita data inválida para campo data', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token);
    const campo = await criarCampo(token, { nome: 'Nascimento', tipo: 'data' });

    const resposta = await request(app)
      .put(`/api/leads/${lead.id}/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: 'não é uma data' });
    expect(resposta.status).toBe(400);
  });

  test('rejeita opção fora da lista para campo selecao', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token);
    const campo = await criarCampo(token, { nome: 'Plano', tipo: 'selecao', opcoes: ['Básico', 'Pro'] });

    const resposta = await request(app)
      .put(`/api/leads/${lead.id}/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: 'Enterprise' });
    expect(resposta.status).toBe(400);
  });

  test('aceita opção válida para campo selecao', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token);
    const campo = await criarCampo(token, { nome: 'Plano', tipo: 'selecao', opcoes: ['Básico', 'Pro'] });

    const resposta = await request(app)
      .put(`/api/leads/${lead.id}/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: 'Pro' });
    expect(resposta.status).toBe(200);
  });

  test('DELETE remove o valor mas não a definição do campo', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token);
    const campo = await criarCampo(token, { nome: 'Observação', tipo: 'texto' });

    await request(app)
      .put(`/api/leads/${lead.id}/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: 'Alguma coisa' });

    const removido = await request(app)
      .delete(`/api/leads/${lead.id}/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(removido.status).toBe(204);

    const lista = await request(app)
      .get(`/api/leads/${lead.id}/campos-personalizados`)
      .set('Authorization', `Bearer ${token}`);
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0].valor).toBeNull();

    const definicao = await request(app).get('/api/campos-personalizados').set('Authorization', `Bearer ${token}`);
    expect(definicao.body).toHaveLength(1);
  });

  test('enviar valor vazio remove o valor (PUT com valor "")', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token);
    const campo = await criarCampo(token, { nome: 'Notas', tipo: 'texto' });

    await request(app)
      .put(`/api/leads/${lead.id}/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: 'Algo' });

    const limpar = await request(app)
      .put(`/api/leads/${lead.id}/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: '' });
    expect(limpar.status).toBe(200);

    const lista = await request(app)
      .get(`/api/leads/${lead.id}/campos-personalizados`)
      .set('Authorization', `Bearer ${token}`);
    expect(lista.body[0].valor).toBeNull();
  });

  test('404 ao usar lead de outro usuário', async () => {
    const { token: tokenA } = await criarUsuarioEToken(app, request);
    const { token: tokenB } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(tokenA);
    const campo = await criarCampo(tokenA, { nome: 'X', tipo: 'texto' });

    const resposta = await request(app)
      .get(`/api/leads/${lead.id}/campos-personalizados`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resposta.status).toBe(404);
  });

  test('remover lead remove os valores associados (cascade)', async () => {
    const { token } = await criarUsuarioEToken(app, request);
    const lead = await criarLead(token);
    const campo = await criarCampo(token, { nome: 'Y', tipo: 'texto' });

    await request(app)
      .put(`/api/leads/${lead.id}/campos-personalizados/${campo.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: 'Z' });

    const remover = await request(app)
      .delete(`/api/leads/${lead.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(remover.status).toBe(204);
  });
});
