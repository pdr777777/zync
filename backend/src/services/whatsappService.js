function enviarMensagem(telefone, texto) {
  console.log(`[WhatsApp mock] Enviando para ${telefone}: ${texto}`);
  return { sucesso: true };
}

module.exports = { enviarMensagem };
