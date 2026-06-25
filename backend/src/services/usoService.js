const assinaturaModel = require('../models/assinaturaModel');
const usoModel = require('../models/usoModel');
const notificacaoModel = require('../models/notificacaoModel');

async function avisarUmaVezNoMes(usuarioId, tipo, mensagem) {
  const jaAvisado = await notificacaoModel.existeDoTipoNoMes(usuarioId, tipo);
  if (jaAvisado) return;

  await notificacaoModel.criar({ usuarioId, leadId: null, tipo, mensagem });
}

async function verificarLimitesEAvisar(usuarioId) {
  const assinatura = await assinaturaModel.buscarAtualPorUsuario(usuarioId);
  if (!assinatura) return;

  const { limite_leads_mes: limiteLeads, limite_mensagens_mes: limiteMensagens, plano_nome: planoNome } = assinatura;
  if (limiteLeads == null && limiteMensagens == null) return;

  if (limiteLeads != null) {
    const totalLeads = await usoModel.contarLeadsDoMes(usuarioId);
    if (totalLeads > limiteLeads) {
      await avisarUmaVezNoMes(
        usuarioId,
        'limite_leads_excedido',
        `Você passou do limite de ${limiteLeads} leads/mês do plano ${planoNome}. Considere fazer upgrade pra continuar crescendo sem se preocupar com isso.`
      );
    }
  }

  if (limiteMensagens != null) {
    const totalMensagens = await usoModel.contarMensagensDoMes(usuarioId);
    if (totalMensagens > limiteMensagens) {
      await avisarUmaVezNoMes(
        usuarioId,
        'limite_mensagens_excedido',
        `Você passou do limite de ${limiteMensagens} mensagens/mês do plano ${planoNome}. Considere fazer upgrade pra continuar crescendo sem se preocupar com isso.`
      );
    }
  }
}

module.exports = { verificarLimitesEAvisar };
