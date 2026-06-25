const { gerarResposta } = require('../src/services/iaService');

describe('iaService', () => {
  const ORIGINAL_FETCH = global.fetch;
  const ORIGINAL_API_KEY = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    process.env.ANTHROPIC_API_KEY = ORIGINAL_API_KEY;
  });

  test('sem ANTHROPIC_API_KEY, usa o mock por palavra-chave', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    global.fetch = jest.fn();

    const resposta = await gerarResposta('Qual o preço da consulta?');

    expect(resposta).toMatch(/valores variam/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('com ANTHROPIC_API_KEY, chama a API da Anthropic e retorna o texto gerado', async () => {
    process.env.ANTHROPIC_API_KEY = 'chave-teste';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'Resposta gerada pela IA' }] }),
    });

    const resposta = await gerarResposta('Oi, gostaria de informações');

    expect(resposta).toBe('Resposta gerada pela IA');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'chave-teste' }),
      })
    );
  });

  test('se a API falhar, cai no mock em vez de lançar', async () => {
    process.env.ANTHROPIC_API_KEY = 'chave-teste';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'erro' });

    const resposta = await gerarResposta('horário de atendimento?');

    expect(resposta).toMatch(/segunda a sábado/i);
  });

  test('monta o system prompt com os dados da empresa quando fornecidos', async () => {
    process.env.ANTHROPIC_API_KEY = 'chave-teste';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    });

    await gerarResposta('Oi', {
      nome_empresa: 'Studio Beleza & Cia',
      ia_o_que_vende: 'Limpeza de pele e design de sobrancelha',
      ia_horario_funcionamento: 'Seg a sáb, 9h às 19h',
      ia_tom_de_voz: 'casual',
    });

    const corpo = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(corpo.system).toContain('Studio Beleza & Cia');
    expect(corpo.system).toContain('Limpeza de pele e design de sobrancelha');
    expect(corpo.system).toContain('Seg a sáb, 9h às 19h');
    expect(corpo.system).toMatch(/casual/i);
  });

  test('sem dados da empresa, usa prompt genérico (sem quebrar)', async () => {
    process.env.ANTHROPIC_API_KEY = 'chave-teste';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    });

    await gerarResposta('Oi');

    const corpo = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(corpo.system).toContain('uma empresa');
  });
});
