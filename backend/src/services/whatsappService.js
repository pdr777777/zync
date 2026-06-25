const Sentry = require('../config/sentry');

function enviarMock(telefone, texto) {
  console.log(`[WhatsApp mock] Enviando para ${telefone}: ${texto}`);
  return { sucesso: true };
}

async function enviarMensagem(telefone, texto) {
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return enviarMock(telefone, texto);
  }

  try {
    const resposta = await fetch(
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: telefone.replace(/\D/g, ''),
          type: 'text',
          text: { body: texto },
        }),
      }
    );

    if (!resposta.ok) {
      const erro = await resposta.text();
      throw new Error(`Falha ao enviar WhatsApp (status ${resposta.status}): ${erro}`);
    }

    return { sucesso: true };
  } catch (err) {
    console.error('Erro ao enviar WhatsApp:', err.message);
    Sentry.captureException(err);
    return { sucesso: false };
  }
}

module.exports = { enviarMensagem };
