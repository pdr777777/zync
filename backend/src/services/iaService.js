const Sentry = require('../config/sentry');

const TOM_DE_VOZ = {
  formal: 'Mantenha um tom formal e cortês.',
  casual: 'Mantenha um tom casual e direto, como numa conversa informal.',
  amigavel: 'Mantenha um tom amigável e caloroso.',
};

function montarSystemPrompt(empresa = {}) {
  const nomeEmpresa = empresa.nome_empresa || empresa.nome;
  const tom = TOM_DE_VOZ[empresa.ia_tom_de_voz] || TOM_DE_VOZ.amigavel;

  let prompt = `Você é o assistente de atendimento ao cliente${nomeEmpresa ? ` da empresa "${nomeEmpresa}"` : ' de uma empresa'}, que usa o Zync (CRM de atendimento via WhatsApp). Responda em português do Brasil, de forma profissional e objetiva (no máximo 2-3 frases). ${tom}`;

  if (empresa.ia_o_que_vende) {
    prompt += `\n\nO que a empresa vende/oferece: ${empresa.ia_o_que_vende}`;
  }

  if (empresa.ia_horario_funcionamento) {
    prompt += `\n\nHorário de funcionamento: ${empresa.ia_horario_funcionamento}`;
  }

  prompt += '\n\nSe o cliente perguntar algo que você não sabe (preço exato, disponibilidade de agenda, endereço, ou qualquer outro dado que não foi passado acima), diga que um atendente vai confirmar em breve e pergunte se pode ajudar com mais alguma coisa. Nunca invente informação.';

  return prompt;
}

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

async function gerarResposta(mensagem, empresa = {}) {
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
        system: montarSystemPrompt(empresa),
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
