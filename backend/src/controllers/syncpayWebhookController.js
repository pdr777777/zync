const assinaturaModel = require('../models/assinaturaModel');
const planoModel = require('../models/planoModel');
const ntfyService = require('../services/ntfyService');
const asyncHandler = require('../utils/asyncHandler');

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
    const plano = await planoModel.buscarPorId(assinatura.plano_id);
    await assinaturaModel.marcarAtiva(dados.id, plano.intervalo_dias);
    ntfyService.notificar('Pagamento recebido no Zync!');
  } else if (dados.status === 'failed' || dados.status === 'refunded') {
    await assinaturaModel.marcarFalha(dados.id);
  }

  res.status(200).send();
}

module.exports = { receber: asyncHandler(receber) };
