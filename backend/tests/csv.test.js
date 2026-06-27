const { paraCsv, deCsv } = require('../src/utils/csv');

describe('csv', () => {
  describe('paraCsv', () => {
    test('gera cabecalho e linhas separadas por virgula', () => {
      const csv = paraCsv([{ nome: 'Fulano', valor: 100 }], ['nome', 'valor']);
      expect(csv).toBe('nome,valor\nFulano,100');
    });

    test('envolve em aspas e escapa aspas internas quando o campo tem virgula, aspas ou quebra de linha', () => {
      const csv = paraCsv([{ nome: 'Fulano, "o bom"\nSilva' }], ['nome']);
      expect(csv).toBe('nome\n"Fulano, ""o bom""\nSilva"');
    });

    test('campo nulo ou indefinido vira string vazia', () => {
      const csv = paraCsv([{ nome: null, servico: undefined }], ['nome', 'servico']);
      expect(csv).toBe('nome,servico\n,');
    });

    test.each(['=cmd|\'/c calc\'!A0', '+1+1', '-1+1', '@SUM(1+1)'])(
      'neutraliza injecao de formula prefixando aspas simples: %s',
      (payload) => {
        const csv = paraCsv([{ nome: payload }], ['nome']);
        expect(csv).toBe(`nome\n'${payload}`);
      }
    );

    test('nome legitimo comecando com letra nao e afetado', () => {
      const csv = paraCsv([{ nome: '-Fulano' }], ['nome']);
      expect(csv).toBe("nome\n'-Fulano");
    });
  });

  describe('deCsv', () => {
    test('faz parse de cabecalho e linhas, normalizando coluna pra minusculo', () => {
      const linhas = deCsv('Nome,Telefone\nFulano,11999999999\nCiclano,11888888888');
      expect(linhas).toEqual([
        { nome: 'Fulano', telefone: '11999999999' },
        { nome: 'Ciclano', telefone: '11888888888' },
      ]);
    });

    test('respeita campo entre aspas com virgula e aspas escapadas', () => {
      const linhas = deCsv('nome,servico\n"Fulano, Jr","Aspas \"\" dentro"');
      expect(linhas).toEqual([{ nome: 'Fulano, Jr', servico: 'Aspas " dentro' }]);
    });

    test('ignora linhas vazias e retorna array vazio para texto vazio ou so cabecalho', () => {
      expect(deCsv('')).toEqual([]);
      expect(deCsv('nome\n\n')).toEqual([]);
    });
  });
});
