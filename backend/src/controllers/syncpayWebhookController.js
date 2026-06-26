const assinaturaModel = require('../models/assinaturaModel');
const planoModel = require('../models/planoModel');
const usuarioModel = require('../models/usuarioModel');
const webhookService = require('../services/webhookService');
const afiliadoService = require('../services/afiliadoService');
const emailService = require('../services/emailService');
const asyncHandler = require('../utils/asyncHandler');
const ntfy = require('../utils/ntfy');

async function receber(req, res) {
  const dados = req.body && req.body.data;
  if (!dados || !dados.id) {
    return res.status(400).json({ error: 'Payload inválido' });
  }

  const assinatura = await assinaturaModel.buscarPorIdentifier(dados.id);
  if (!assinatura) {
    return res.status(200).send();
  }

  if (dados.status === 'completed') {
    if (assinatura.status === 'ativa') {
      return res.status(200).send();
    }
    const plano = await planoModel.buscarPorId(assinatura.plano_id);
    await assinaturaModel.marcarAtiva(dados.id, plano.intervalo_dias);
    await afiliadoService.gerarComissaoSeAplicavel(assinatura);
    ntfy.notificar('Pagamento recebido no Zync!', { titulo: 'Zync · Pagamento aprovado', tag: 'moneybag' });
    webhookService.disparar(assinatura.usuario_id, 'pagamento_aprovado', {
      assinaturaId: assinatura.id,
      planoNome: plano.nome,
      valor: assinatura.valor,
    });

    const usuario = await usuarioModel.buscarPorId(assinatura.usuario_id);
    if (usuario) {
      emailService.enviarEmail(
        usuario.email,
        'Pagamento aprovado - Zync',
        `Oi, ${usuario.nome}! Seu pagamento do plano ${plano.nome} foi aprovado e sua assinatura já está ativa. Aproveite o Zync!`
      );
    }
  } else if (dados.status === 'failed' || dados.status === 'refunded') {
    if (assinatura.status === 'cancelada') {
      return res.status(200).send();
    }
    await assinaturaModel.marcarFalha(dados.id);
  }

  res.status(200).send();
}

module.exports = { receber: asyncHandler(receber) };
