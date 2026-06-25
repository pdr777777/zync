const Sentry = require('../config/sentry');

async function enviarEmail(destinatario, assunto, corpo) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[Email mock] Para: ${destinatario} | Assunto: ${assunto}\n${corpo}`);
    return { sucesso: true };
  }

  try {
    const resposta = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: destinatario }] }],
        from: { email: process.env.EMAIL_FROM, name: 'Zync' },
        subject: assunto,
        content: [{ type: 'text/plain', value: corpo }],
      }),
    });

    if (!resposta.ok) {
      const erro = await resposta.text();
      throw new Error(`Falha ao enviar e-mail via SendGrid (status ${resposta.status}): ${erro}`);
    }

    return { sucesso: true };
  } catch (err) {
    console.error('Erro ao enviar e-mail:', err.message);
    Sentry.captureException(err);
    return { sucesso: false };
  }
}

module.exports = { enviarEmail };
