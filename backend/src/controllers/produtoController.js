const produtoModel = require('../models/produtoModel');
const usuarioModel = require('../models/usuarioModel');
const leadModel = require('../models/leadModel');
const logModel = require('../models/logModel');
const notificacaoModel = require('../models/notificacaoModel');
const webhookService = require('../services/webhookService');
const asyncHandler = require('../utils/asyncHandler');
const validators = require('../utils/validators');
const frontendUrl = require('../utils/frontendUrl');

function validarProduto(dados, { exigirNome }) {
  if (exigirNome && !dados.nome) return 'nome é obrigatório';
  if (!validators.dentroDoTamanho(dados.nome, 120)) return 'nome deve ter no máximo 120 caracteres';
  if (!validators.dentroDoTamanho(dados.descricao, 500)) return 'descricao deve ter no máximo 500 caracteres';

  if (exigirNome && dados.preco === undefined) return 'preco é obrigatório';
  if (dados.preco !== undefined && !validators.valorPositivo(dados.preco)) return 'preco deve ser um número positivo';

  return null;
}

async function listar(req, res) {
  const produtos = await produtoModel.listarPorUsuario(req.usuario.id);
  res.json(produtos);
}

async function criar(req, res) {
  const { nome, descricao, preco, fotoUrl } = req.body;

  const erro = validarProduto(req.body, { exigirNome: true });
  if (erro) return res.status(400).json({ error: erro });

  const produto = await produtoModel.criar({ usuarioId: req.usuario.id, nome, descricao, preco, fotoUrl });
  res.status(201).json(produto);
}

async function atualizar(req, res) {
  const produto = await produtoModel.buscarPorId(req.params.id, req.usuario.id);
  if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

  const erro = validarProduto(req.body, { exigirNome: false });
  if (erro) return res.status(400).json({ error: erro });

  const atualizado = await produtoModel.atualizar(req.params.id, req.usuario.id, req.body);
  res.json(atualizado);
}

async function remover(req, res) {
  const produto = await produtoModel.buscarPorId(req.params.id, req.usuario.id);
  if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

  await produtoModel.remover(req.params.id, req.usuario.id);
  res.status(204).send();
}

async function obterLink(req, res) {
  const slug = await usuarioModel.garantirSlugCatalogo(req.usuario.id);
  res.json({ slug, url: `${frontendUrl.urlPrincipal()}/pages/loja.html?slug=${slug}` });
}

async function catalogoPublico(req, res) {
  const usuario = await usuarioModel.buscarPorSlugCatalogo(req.params.slug);
  if (!usuario) return res.status(404).json({ error: 'Catálogo não encontrado' });

  const produtos = await produtoModel.listarAtivosPorUsuarioId(usuario.id);
  res.json({ nomeLoja: usuario.nome, produtos });
}

async function solicitar(req, res) {
  const usuario = await usuarioModel.buscarPorSlugCatalogo(req.params.slug);
  if (!usuario) return res.status(404).json({ error: 'Catálogo não encontrado' });

  const { produtoId, nomeCliente, telefoneCliente, mensagem } = req.body;

  if (!nomeCliente) return res.status(400).json({ error: 'nomeCliente é obrigatório' });
  if (!produtoId) return res.status(400).json({ error: 'produtoId é obrigatório' });
  if (!validators.dentroDoTamanho(nomeCliente, 120)) return res.status(400).json({ error: 'nomeCliente deve ter no máximo 120 caracteres' });
  if (!validators.dentroDoTamanho(telefoneCliente, 20)) return res.status(400).json({ error: 'telefoneCliente deve ter no máximo 20 caracteres' });
  if (!validators.dentroDoTamanho(mensagem, 500)) return res.status(400).json({ error: 'mensagem deve ter no máximo 500 caracteres' });

  const produto = await produtoModel.buscarPorId(produtoId, usuario.id);
  if (!produto || !produto.ativo) return res.status(404).json({ error: 'Produto não encontrado' });

  let lead;
  try {
    lead = await leadModel.criar({
      usuarioId: usuario.id,
      nome: nomeCliente,
      telefone: telefoneCliente,
      servico: produto.nome,
      origem: 'catalogo',
      valor: produto.preco,
    });
  } catch (err) {
    // telefone já é de outro lead desse usuario (UNIQUE usuario_id+telefone) --
    // do ponto de vista do cliente final o pedido foi recebido normalmente,
    // o vendedor já tem esse contato e vai falar com ele sobre os dois pedidos.
    if (err.code === '23505') return res.status(201).json({ sucesso: true });
    throw err;
  }

  await logModel.registrar({
    usuarioId: usuario.id,
    leadId: lead.id,
    acao: 'lead_criado',
    detalhes: { nome: lead.nome, origem: 'catalogo' },
  });

  await notificacaoModel.criar({
    usuarioId: usuario.id,
    leadId: lead.id,
    tipo: 'lead_criado',
    mensagem: `Novo lead: ${lead.nome}`,
  });

  webhookService.disparar(usuario.id, 'lead_criado', {
    id: lead.id,
    nome: lead.nome,
    servico: lead.servico,
    origem: lead.origem,
    status: lead.status,
  });

  res.status(201).json({ sucesso: true });
}

module.exports = {
  listar: asyncHandler(listar),
  criar: asyncHandler(criar),
  atualizar: asyncHandler(atualizar),
  remover: asyncHandler(remover),
  obterLink: asyncHandler(obterLink),
  catalogoPublico: asyncHandler(catalogoPublico),
  solicitar: asyncHandler(solicitar),
};
