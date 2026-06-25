const ntfy = require('../src/utils/ntfy');

describe('utils/ntfy', () => {
  const ORIGINAL_FETCH = global.fetch;
  const ORIGINAL_TOPIC = process.env.NTFY_TOPIC;

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    process.env.NTFY_TOPIC = ORIGINAL_TOPIC;
  });

  test('sem NTFY_TOPIC, não chama fetch', async () => {
    delete process.env.NTFY_TOPIC;
    global.fetch = jest.fn();

    await ntfy.notificar('Evento qualquer');

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('com NTFY_TOPIC, chama o ntfy.sh com a mensagem e os headers certos', async () => {
    process.env.NTFY_TOPIC = 'topico-teste';
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    await ntfy.notificar('Novo cadastro no Zync!', { titulo: 'Zync · Novo cadastro', tag: 'tada' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://ntfy.sh/topico-teste',
      expect.objectContaining({
        method: 'POST',
        headers: { Title: 'Zync · Novo cadastro', Tags: 'tada' },
        body: 'Novo cadastro no Zync!',
      })
    );
  });

  test('se o ntfy falhar, não lança (best-effort)', async () => {
    process.env.NTFY_TOPIC = 'topico-teste';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(ntfy.notificar('Evento qualquer')).resolves.toBeUndefined();
  });
});
