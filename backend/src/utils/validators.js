const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STATUS_LEAD = ['novo', 'em_contato', 'proposta_enviada', 'fechado'];
const STATUS_AGENDAMENTO = ['agendado', 'confirmado', 'cancelado', 'concluido'];
const ENVIADO_POR = ['ia', 'humano', 'cliente'];

function emailValido(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

function senhaValida(senha) {
  return typeof senha === 'string' && senha.length >= 6;
}

function dataValida(data) {
  return typeof data === 'string' && !isNaN(new Date(data).getTime());
}

function valorPositivo(valor) {
  const numero = typeof valor === 'number' ? valor : parseFloat(valor);
  return !isNaN(numero) && numero >= 0;
}

module.exports = {
  emailValido,
  senhaValida,
  dataValida,
  valorPositivo,
  STATUS_LEAD,
  STATUS_AGENDAMENTO,
  ENVIADO_POR,
};
