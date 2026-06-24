function gerarResposta(mensagem) {
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

module.exports = { gerarResposta };
