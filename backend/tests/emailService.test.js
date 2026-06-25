const { enviarEmail } = require('../src/services/emailService');

describe('emailService', () => {
  const ORIGINAL_FETCH = global.fetch;
  const ORIGINAL_API_KEY = process.env.SENDGRID_API_KEY;
  const ORIGINAL_FROM = process.env.EMAIL_FROM;

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    process.env.SENDGRID_API_KEY = ORIGINAL_API_KEY;
    process.env.EMAIL_FROM = ORIGINAL_FROM;
    jest.restoreAllMocks();
  });

  test('sem SENDGRID_API_KEY, usa o mock e não chama fetch', async () => {
    delete process.env.SENDGRID_API_KEY;
    global.fetch = jest.fn();

    const resultado = await enviarEmail('cliente@zync.com', 'Assunto', 'Corpo');

    expect(resultado).toEqual({ sucesso: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('com SENDGRID_API_KEY, chama a API do SendGrid corretamente', async () => {
    process.env.SENDGRID_API_KEY = 'chave-teste';
    process.env.EMAIL_FROM = 'noreply@zync.com';
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const resultado = await enviarEmail('cliente@zync.com', 'Assunto', 'Corpo');

    expect(resultado).toEqual({ sucesso: true });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.sendgrid.com/v3/mail/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer chave-teste' }),
      })
    );

    const corpoEnviado = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(corpoEnviado.personalizations[0].to[0].email).toBe('cliente@zync.com');
    expect(corpoEnviado.from.email).toBe('noreply@zync.com');
  });

  test('se o SendGrid retornar erro, captura e retorna sucesso: false (sem lançar)', async () => {
    process.env.SENDGRID_API_KEY = 'chave-teste';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' });

    const resultado = await enviarEmail('cliente@zync.com', 'Assunto', 'Corpo');

    expect(resultado).toEqual({ sucesso: false });
  });
});
