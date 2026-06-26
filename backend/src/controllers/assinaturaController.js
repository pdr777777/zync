const planoModel = require('../models/planoModel');
const assinaturaModel = require('../models/assinaturaModel');
const usoModel = require('../models/usoModel');
const usuarioModel = require('../models/usuarioModel');
const syncpayService = require('../services/syncpayService');
const emailService = require('../services/emailService');
const logModel = require('../models/logModel');
const asyncHandler = require('../utils/asyncHandler');
const validators = require('../utils/validators');

async function checkout(req, res) {
  const { planoId, nome, cpf, email, telefone } = req.body;

  if (!planoId || !nome || !cpf || !email || !telefone) {
    return res.status(400).json({ error: 'planoId, nome, cpf, email e telefone são obrigatórios' });
  }

  if (!validators.cpfValido(cpf)) {
    return res.status(400).json({ error: 'cpf inválido' });
  }

  if (!validators.emailValido(email)) {
    return res.status(400).json({ error: 'email inválido' });
  }

  const plano = await planoModel.buscarPorId(planoId);
  if (!plano || !plano.ativo) {
    return res.status(404).json({ error: 'Plano não encontrado' });
  }

  const webhookUrl = `${process.env.BACKEND_PUBLIC_URL}/api/webhooks/syncpay`;

  const { pixCode, identifier } = await syncpayService.criarCobrancaPix({
    valor: plano.preco,
    descricao: `Assinatura Zync - ${plano.nome}`,
    cliente: { name: nome, cpf: cpf.replace(/\D/g, ''), email, phone: telefone.replace(/\D/g, '') },
    webhookUrl,
  });

  const assinatura = await assinaturaModel.criar({
    usuarioId: req.usuario.id,
    planoId: plano.id,
    valor: plano.preco,
    syncpayIdentifier: identifier,
    pixCode,
  });

  res.status(201).json({
    assinaturaId: assinatura.id,
    pixCode,
    identifier,
    valor: plano.preco,
  });
}

async function atual(req, res) {
  const assinatura = await assinaturaModel.buscarAtualPorUsuario(req.usuario.id);
  res.json(assinatura || null);
}

async function historico(req, res) {
  const assinaturas = await assinaturaModel.listarPorUsuario(req.usuario.id);
  res.json(assinaturas);
}

async function uso(req, res) {
  const assinatura = await assinaturaModel.buscarAtualPorUsuario(req.usuario.id);

  const [leadsUsados, mensagensUsadas] = await Promise.all([
    usoModel.contarLeadsDoMes(req.usuario.id),
    usoModel.contarMensagensDoMes(req.usuario.id),
  ]);

  res.json({
    plano: assinatura ? assinatura.plano_nome : null,
    leads: { usado: leadsUsados, limite: assinatura ? assinatura.limite_leads_mes : null },
    mensagens: { usado: mensagensUsadas, limite: assinatura ? assinatura.limite_mensagens_mes : null },
  });
}

async function cancelar(req, res) {
  const assinatura = await assinaturaModel.buscarAtualPorUsuario(req.usuario.id);
  if (!assinatura || assinatura.status !== 'ativa') {
    return res.status(400).json({ error: 'Não há assinatura ativa para cancelar' });
  }

  await assinaturaModel.cancelar(assinatura.id, req.usuario.id);

  await logModel.registrar({
    usuarioId: req.usuario.id,
    acao: 'assinatura_cancelada',
    detalhes: { plano: assinatura.plano_nome },
  });

  const usuario = await usuarioModel.buscarPorId(req.usuario.id);
  if (usuario) {
    emailService.enviarEmail(
      usuario.email,
      'Assinatura cancelada - Zync',
      `Oi, ${usuario.nome}. Confirmamos o cancelamento da sua assinatura do plano ${assinatura.plano_nome}. Se quiser voltar, é só assinar de novo em Configurações quando quiser.`
    );
  }

  res.status(204).send();
}

module.exports = {
  checkout: asyncHandler(checkout),
  atual: asyncHandler(atual),
  historico: asyncHandler(historico),
  cancelar: asyncHandler(cancelar),
  uso: asyncHandler(uso),
};
