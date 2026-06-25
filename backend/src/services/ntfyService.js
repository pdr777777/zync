const Sentry = require('../config/sentry');

async function notificar(mensagem) {
  if (!process.env.NTFY_TOPIC) return { sucesso: true };

  try {
    const resposta = await fetch(`https://ntfy.sh/${process.env.NTFY_TOPIC}`, {
      method: 'POST',
      body: mensagem,
    });

    if (!resposta.ok) {
      throw new Error(`Falha ao notificar via ntfy (status ${resposta.status})`);
    }

    return { sucesso: true };
  } catch (err) {
    console.error('Erro ao notificar via ntfy:', err.message);
    Sentry.captureException(err);
    return { sucesso: false };
  }
}

module.exports = { notificar };
