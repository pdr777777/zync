const { enviarMensagem } = require('../src/services/whatsappService');

describe('whatsappService', () => {
  const ORIGINAL_FETCH = global.fetch;
  const ORIGINAL_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const ORIGINAL_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    process.env.WHATSAPP_ACCESS_TOKEN = ORIGINAL_TOKEN;
    process.env.WHATSAPP_PHONE_NUMBER_ID = ORIGINAL_PHONE_ID;
  });

  test('sem credenciais, cai no mock e nao chama fetch', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    global.fetch = jest.fn();

    const resultado = await enviarMensagem('11999999999', 'Oi');

    expect(resultado).toEqual({ sucesso: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('com credenciais, chama a API do WhatsApp Cloud com o telefone limpo', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'token-teste';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456';
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const resultado = await enviarMensagem('(11) 99999-9999', 'Olá, tudo bem?');

    expect(resultado).toEqual({ sucesso: true });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v21.0/123456/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-teste' }),
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '11999999999',
          type: 'text',
          text: { body: 'Olá, tudo bem?' },
        }),
      })
    );
  });

  test('se a API falhar, retorna sucesso false em vez de lancar', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'token-teste';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'erro' });

    const resultado = await enviarMensagem('11999999999', 'Oi');

    expect(resultado).toEqual({ sucesso: false });
  });
});
