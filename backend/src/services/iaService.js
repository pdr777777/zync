const Sentry = require('../config/sentry');

const SYSTEM_PROMPT = `Você é o assistente de atendimento ao cliente de uma empresa que usa o Zync (CRM de atendimento via WhatsApp). Responda em português do Brasil, de forma simpática, profissional e objetiva (no máximo 2-3 frases).

Você não tem acesso a preços, horários de funcionamento, endereço ou disponibilidade de agenda da empresa — nunca invente esses dados. Se o cliente perguntar isso, diga que um atendente vai confirmar em breve e pergunte se pode ajudar com mais alguma coisa.`;

function respostaMock(mensagem) {
  const texto = mensagem.toLowerCase();

  if (texto.includes('preço') || texto.includes('preco') || texto.includes('valor')) {
    return 'Nossos valores variam de acordo com o serviço. Posso te passar os detalhes ou agendar uma consulta para avaliação?';
  }

  if (texto.includes('horário') || texto.includes('horario') || texto.includes('agenda')) {
    return 'Atendemos de segunda a sábado, das 8h às 18h. Quer que eu agende um horário pra você?';
  }

  if (texto.includes('endereço') || texto.includes('endereco') || texto.includes('local')) {
    return 'Estamos localizados no centro da cidade. Posso te enviar a localização exata?';
  }

  return 'Obrigado pela mensagem! Em breve um de nossos atendentes vai te responder. Posso ajudar com mais alguma coisa?';
}

async function gerarResposta(mensagem) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return respostaMock(mensagem);
  }

  try {
    const resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: mensagem }],
      }),
    });

    if (!resposta.ok) {
      const erro = await resposta.text();
      throw new Error(`Falha ao chamar a IA (status ${resposta.status}): ${erro}`);
    }

    const dados = await resposta.json();
    const texto = dados.content && dados.content[0] && dados.content[0].text;
    return texto || respostaMock(mensagem);
  } catch (err) {
    console.error('Erro ao gerar resposta de IA:', err.message);
    Sentry.captureException(err);
    return respostaMock(mensagem);
  }
}

module.exports = { gerarResposta };
