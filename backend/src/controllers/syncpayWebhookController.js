const assinaturaModel = require('../models/assinaturaModel');
const planoModel = require('../models/planoModel');
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
    const plano = await planoModel.buscarPorId(assinatura.plano_id);
    await assinaturaModel.marcarAtiva(dados.id, plano.intervalo_dias);
    ntfy.notificar('Pagamento recebido no Zync!', { titulo: 'Zync · Pagamento aprovado', tag: 'moneybag' });
  } else if (dados.status === 'failed' || dados.status === 'refunded') {
    await assinaturaModel.marcarFalha(dados.id);
  }

  res.status(200).send();
}

module.exports = { receber: asyncHandler(receber) };
