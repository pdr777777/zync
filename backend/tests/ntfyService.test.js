const { notificar } = require('../src/services/ntfyService');

describe('ntfyService', () => {
  const ORIGINAL_FETCH = global.fetch;
  const ORIGINAL_TOPIC = process.env.NTFY_TOPIC;

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    process.env.NTFY_TOPIC = ORIGINAL_TOPIC;
  });

  test('sem NTFY_TOPIC, não chama fetch', async () => {
    delete process.env.NTFY_TOPIC;
    global.fetch = jest.fn();

    const resultado = await notificar('Evento qualquer');

    expect(resultado).toEqual({ sucesso: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('com NTFY_TOPIC, chama o ntfy.sh com a mensagem', async () => {
    process.env.NTFY_TOPIC = 'topico-teste';
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const resultado = await notificar('Novo cadastro no Zync!');

    expect(resultado).toEqual({ sucesso: true });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://ntfy.sh/topico-teste',
      expect.objectContaining({ method: 'POST', body: 'Novo cadastro no Zync!' })
    );
  });

  test('se o ntfy falhar, captura e retorna sucesso: false (sem lançar)', async () => {
    process.env.NTFY_TOPIC = 'topico-teste';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

    const resultado = await notificar('Evento qualquer');

    expect(resultado).toEqual({ sucesso: false });
  });
});
