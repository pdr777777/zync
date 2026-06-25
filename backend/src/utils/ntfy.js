const Sentry = require('../config/sentry');

async function notificar(mensagem, { titulo, tag } = {}) {
  const topico = process.env.NTFY_TOPIC;
  if (!topico) return;

  try {
    const resposta = await fetch(`https://ntfy.sh/${topico}`, {
      method: 'POST',
      headers: {
        Title: titulo || 'Zync',
        Tags: tag || 'bell',
      },
      body: mensagem,
    });

    if (!resposta.ok) {
      throw new Error(`Falha ao notificar via ntfy (status ${resposta.status})`);
    }
  } catch (err) {
    /* alerta e best-effort -- nunca pode quebrar o fluxo principal (login/cadastro/pagamento) */
    console.error('Erro ao notificar via ntfy:', err.message);
    Sentry.captureException(err);
  }
}

module.exports = { notificar };
