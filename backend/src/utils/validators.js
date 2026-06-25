const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STATUS_LEAD = ['novo', 'em_contato', 'proposta_enviada', 'fechado'];
const STATUS_AGENDAMENTO = ['agendado', 'confirmado', 'cancelado', 'concluido'];
const ENVIADO_POR = ['ia', 'humano', 'cliente'];

function emailValido(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

function senhaValida(senha) {
  if (typeof senha !== 'string' || senha.length < 8) return false;
  return /[a-zA-Z]/.test(senha) && /[0-9]/.test(senha);
}

function dataValida(data) {
  return typeof data === 'string' && !isNaN(new Date(data).getTime());
}

function valorPositivo(valor) {
  const numero = typeof valor === 'number' ? valor : parseFloat(valor);
  return !isNaN(numero) && numero >= 0;
}

function numeroValido(valor) {
  const numero = typeof valor === 'number' ? valor : parseFloat(valor);
  return !isNaN(numero);
}

function dentroDoTamanho(valor, max) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.length <= max);
}

function cpfValido(cpf) {
  if (typeof cpf !== 'string') return false;
  const digitos = cpf.replace(/\D/g, '');
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;

  const calcularDigito = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) {
      soma += parseInt(digitos[i], 10) * (tamanho + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(9) === parseInt(digitos[9], 10) && calcularDigito(10) === parseInt(digitos[10], 10);
}

module.exports = {
  emailValido,
  senhaValida,
  dataValida,
  valorPositivo,
  numeroValido,
  cpfValido,
  dentroDoTamanho,
  STATUS_LEAD,
  STATUS_AGENDAMENTO,
  ENVIADO_POR,
};
