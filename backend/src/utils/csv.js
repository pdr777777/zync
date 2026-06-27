function escaparCampo(valor) {
  if (valor === null || valor === undefined) return '';
  let texto = valor instanceof Date ? valor.toISOString() : String(valor);

  // Neutraliza injeção de fórmula: um valor começando com =, +, -, @ é
  // interpretado como fórmula por Excel/Sheets ao abrir o CSV exportado.
  if (/^[=+\-@]/.test(texto)) {
    texto = `'${texto}`;
  }

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

function parseLinhaCsv(linha) {
  const campos = [];
  let atual = '';
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const char = linha[i];

    if (dentroDeAspas) {
      if (char === '"') {
        if (linha[i + 1] === '"') { atual += '"'; i++; }
        else dentroDeAspas = false;
      } else {
        atual += char;
      }
    } else if (char === '"') {
      dentroDeAspas = true;
    } else if (char === ',') {
      campos.push(atual);
      atual = '';
    } else {
      atual += char;
    }
  }

  campos.push(atual);
  return campos;
}

function deCsv(texto) {
  const linhas = texto.split(/\r\n|\n|\r/).filter((linha) => linha.length > 0);
  if (linhas.length === 0) return [];

  const cabecalho = parseLinhaCsv(linhas[0]).map((coluna) => coluna.trim().toLowerCase());

  return linhas.slice(1).map((linha) => {
    const campos = parseLinhaCsv(linha);
    const objeto = {};
    cabecalho.forEach((coluna, i) => { objeto[coluna] = (campos[i] ?? '').trim(); });
    return objeto;
  });
}

module.exports = { paraCsv, deCsv };
