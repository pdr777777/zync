const adminModel = require('../models/adminModel');
const planoModel = require('../models/planoModel');
const usuarioModel = require('../models/usuarioModel');
const suporteModel = require('../models/suporteModel');
const assinaturaModel = require('../models/assinaturaModel');
const afiliadoModel = require('../models/afiliadoModel');
const comissaoAfiliadoModel = require('../models/comissaoAfiliadoModel');
const logModel = require('../models/logModel');
const emailService = require('../services/emailService');
const asyncHandler = require('../utils/asyncHandler');
const validators = require('../utils/validators');

async function listarUsuarios(req, res) {
  const usuarios = await adminModel.listarUsuarios({ incluirRemovidos: req.query.incluirRemovidos === 'true' });
  res.json(usuarios);
}

async function metricas(req, res) {
  const dados = await adminModel.metricas();
  res.json(dados);
}

async function definirAdmin(req, res) {
  const { isAdmin } = req.body;
  if (typeof isAdmin !== 'boolean') {
    return res.status(400).json({ error: 'isAdmin deve ser true ou false' });
  }

  const usuario = await usuarioModel.buscarPorId(req.params.id);
  if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });

  if (Number(req.params.id) === req.usuario.id && !isAdmin) {
    return res.status(400).json({ error: 'Você não pode revogar seu próprio acesso de administrador' });
  }

  await usuarioModel.definirAdmin(req.params.id, isAdmin);

  await logModel.registrar({
    usuarioId: req.usuario.id,
    acao: 'admin_definiu_admin',
    detalhes: { usuarioAlvoId: Number(req.params.id), isAdmin },
  });

  res.json({ ok: true });
}

async function removerUsuario(req, res) {
  const usuario = await usuarioModel.buscarPorId(req.params.id);
  if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });

  if (Number(req.params.id) === req.usuario.id) {
    return res.status(400).json({ error: 'Você não pode remover a própria conta por aqui' });
  }

  await adminModel.removerUsuario(req.params.id);

  await logModel.registrar({
    usuarioId: req.usuario.id,
    acao: 'admin_removeu_empresa',
    detalhes: { usuarioAlvoId: Number(req.params.id), usuarioAlvoEmail: usuario.email },
  });

  res.status(204).send();
}

async function reativarUsuario(req, res) {
  const usuario = await usuarioModel.buscarPorId(req.params.id);
  if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });

  await adminModel.reativarUsuario(req.params.id);

  await logModel.registrar({
    usuarioId: req.usuario.id,
    acao: 'admin_reativou_empresa',
    detalhes: { usuarioAlvoId: Number(req.params.id), usuarioAlvoEmail: usuario.email },
  });

  res.status(204).send();
}

async function cancelarAssinatura(req, res) {
  const assinatura = await assinaturaModel.buscarAtualPorUsuario(req.params.id);
  if (!assinatura || assinatura.status !== 'ativa') {
    return res.status(400).json({ error: 'Não há assinatura ativa para cancelar' });
  }

  await assinaturaModel.cancelar(assinatura.id, req.params.id);

  await logModel.registrar({
    usuarioId: req.usuario.id,
    acao: 'admin_cancelou_assinatura',
    detalhes: { usuarioAlvoId: Number(req.params.id), plano: assinatura.plano_nome },
  });

  const usuarioAlvo = await usuarioModel.buscarPorId(req.params.id);
  if (usuarioAlvo) {
    emailService.enviarEmail(
      usuarioAlvo.email,
      'Assinatura cancelada - Zync',
      `Oi, ${usuarioAlvo.nome}. Sua assinatura do plano ${assinatura.plano_nome} foi cancelada. Se quiser voltar, é só assinar de novo em Configurações quando quiser.`
    );
  }

  res.status(204).send();
}

async function listarPlanos(req, res) {
  const planos = await planoModel.listarTodos();
  res.json(planos);
}

async function criarPlano(req, res) {
  const { nome, preco, intervaloDias } = req.body;

  if (!nome || preco === undefined) {
    return res.status(400).json({ error: 'nome e preco são obrigatórios' });
  }

  if (!validators.valorPositivo(preco)) {
    return res.status(400).json({ error: 'preco deve ser um número positivo' });
  }

  if (intervaloDias !== undefined && (!Number.isInteger(intervaloDias) || intervaloDias <= 0)) {
    return res.status(400).json({ error: 'intervaloDias deve ser um número inteiro positivo' });
  }

  const plano = await planoModel.criar({ nome, preco, intervaloDias });

  await logModel.registrar({
    usuarioId: req.usuario.id,
    acao: 'admin_criou_plano',
    detalhes: { planoId: plano.id, nome, preco },
  });

  res.status(201).json(plano);
}

async function atualizarPlano(req, res) {
  const plano = await planoModel.buscarPorId(req.params.id);
  if (!plano) return res.status(404).json({ error: 'Plano não encontrado' });

  if (req.body.preco !== undefined && !validators.valorPositivo(req.body.preco)) {
    return res.status(400).json({ error: 'preco deve ser um número positivo' });
  }

  if (
    req.body.intervaloDias !== undefined &&
    (!Number.isInteger(req.body.intervaloDias) || req.body.intervaloDias <= 0)
  ) {
    return res.status(400).json({ error: 'intervaloDias deve ser um número inteiro positivo' });
  }

  const atualizado = await planoModel.atualizar(req.params.id, req.body);

  await logModel.registrar({
    usuarioId: req.usuario.id,
    acao: 'admin_atualizou_plano',
    detalhes: { planoId: Number(req.params.id), mudancas: req.body },
  });

  res.json(atualizado);
}

async function listarSuporte(req, res) {
  const itens = await suporteModel.listarTodas();
  res.json(itens);
}

async function responderSuporte(req, res) {
  const item = await suporteModel.buscarPorId(req.params.id);
  if (!item) return res.status(404).json({ error: 'Mensagem não encontrada' });

  await suporteModel.marcarRespondida(req.params.id);
  res.status(204).send();
}

async function listarAfiliados(req, res) {
  const afiliados = await afiliadoModel.listarTodos();
  res.json(afiliados);
}

async function criarAfiliado(req, res) {
  const { email, percentualComissao } = req.body;

  if (!email) return res.status(400).json({ error: 'email é obrigatório' });

  if (
    percentualComissao !== undefined &&
    (typeof percentualComissao !== 'number' || percentualComissao <= 0 || percentualComissao > 100)
  ) {
    return res.status(400).json({ error: 'percentualComissao deve ser um número entre 0 e 100' });
  }

  const usuario = await usuarioModel.findByEmail(email);
  if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado com esse e-mail' });

  const existente = await afiliadoModel.buscarPorUsuarioId(usuario.id);
  if (existente) return res.status(409).json({ error: 'Esse usuário já é afiliado' });

  const afiliado = await afiliadoModel.criar({ usuarioId: usuario.id, percentualComissao });
  res.status(201).json(afiliado);
}

async function atualizarAfiliado(req, res) {
  const afiliado = await afiliadoModel.buscarPorId(req.params.id);
  if (!afiliado) return res.status(404).json({ error: 'Afiliado não encontrado' });

  if (
    req.body.percentual_comissao !== undefined &&
    (typeof req.body.percentual_comissao !== 'number' || req.body.percentual_comissao <= 0 || req.body.percentual_comissao > 100)
  ) {
    return res.status(400).json({ error: 'percentual_comissao deve ser um número entre 0 e 100' });
  }

  const atualizado = await afiliadoModel.atualizar(req.params.id, req.body);
  res.json(atualizado);
}

async function listarComissoesAfiliado(req, res) {
  const afiliado = await afiliadoModel.buscarPorId(req.params.id);
  if (!afiliado) return res.status(404).json({ error: 'Afiliado não encontrado' });

  const comissoes = await comissaoAfiliadoModel.listarPorAfiliado(req.params.id);
  res.json(comissoes);
}

async function marcarComissaoPaga(req, res) {
  const comissao = await comissaoAfiliadoModel.buscarPorId(req.params.id);
  if (!comissao) return res.status(404).json({ error: 'Comissão não encontrada' });

  await comissaoAfiliadoModel.marcarPaga(req.params.id);

  await logModel.registrar({
    usuarioId: req.usuario.id,
    acao: 'admin_marcou_comissao_paga',
    detalhes: { comissaoId: Number(req.params.id) },
  });

  res.status(204).send();
}

module.exports = {
  listarUsuarios: asyncHandler(listarUsuarios),
  metricas: asyncHandler(metricas),
  definirAdmin: asyncHandler(definirAdmin),
  removerUsuario: asyncHandler(removerUsuario),
  reativarUsuario: asyncHandler(reativarUsuario),
  cancelarAssinatura: asyncHandler(cancelarAssinatura),
  listarPlanos: asyncHandler(listarPlanos),
  criarPlano: asyncHandler(criarPlano),
  atualizarPlano: asyncHandler(atualizarPlano),
  listarSuporte: asyncHandler(listarSuporte),
  responderSuporte: asyncHandler(responderSuporte),
  listarAfiliados: asyncHandler(listarAfiliados),
  criarAfiliado: asyncHandler(criarAfiliado),
  atualizarAfiliado: asyncHandler(atualizarAfiliado),
  listarComissoesAfiliado: asyncHandler(listarComissoesAfiliado),
  marcarComissaoPaga: asyncHandler(marcarComissaoPaga),
};
