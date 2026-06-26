const assinaturaModel = require('../models/assinaturaModel');
const notificacaoModel = require('../models/notificacaoModel');
const logModel = require('../models/logModel');
const emailService = require('../services/emailService');
const Sentry = require('../config/sentry');

async function verificarAssinaturasExpiradas() {
  const expiradas = await assinaturaModel.listarAtivasExpiradas();

  for (const assinatura of expiradas) {
    try {
      await assinaturaModel.marcarExpirada(assinatura.id);

      await notificacaoModel.criar({
        usuarioId: assinatura.usuario_id,
        tipo: 'assinatura_expirada',
        mensagem: `Sua assinatura do plano ${assinatura.plano_nome} expirou.`,
      });

      await logModel.registrar({
        usuarioId: assinatura.usuario_id,
        acao: 'assinatura_expirada',
        detalhes: { plano: assinatura.plano_nome },
      });

      emailService.enviarEmail(
        assinatura.usuario_email,
        'Sua assinatura Zync expirou',
        `Oi, ${assinatura.usuario_nome}! Sua assinatura do plano ${assinatura.plano_nome} expirou. Acesse Configurações para renovar e continuar usando o Zync normalmente.`
      );
    } catch (err) {
      console.error(`Erro ao processar expiração da assinatura ${assinatura.id}:`, err.message);
      Sentry.captureException(err);
    }
  }

  return expiradas.length;
}

module.exports = { verificarAssinaturasExpiradas };
