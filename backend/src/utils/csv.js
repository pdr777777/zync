function escaparCampo(valor) {
  if (valor === null || valor === undefined) return '';
  const texto = valor instanceof Date ? valor.toISOString() : String(valor);
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

function paraCsv(linhas, colunas) {
  const cabecalho = colunas.join(',');
  const corpo = linhas.map((linha) => colunas.map((coluna) => escaparCampo(linha[coluna])).join(','));
  return [cabecalho, ...corpo].join('\n');
}

module.exports = { paraCsv };
