describe('syncpayService', () => {
  const ORIGINAL_ENV = { ...process.env };
  let syncpayService;

  beforeEach(() => {
    jest.resetModules();
    process.env.SYNCPAY_BASE_URL = 'https://api.syncpay.test';
    process.env.SYNCPAY_CLIENT_ID = 'client-teste';
    process.env.SYNCPAY_CLIENT_SECRET = 'secret-teste';
    syncpayService = require('../src/services/syncpayService');
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  function mockAuthOk(expiresIn = 3600) {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'token-fake', expires_in: expiresIn }),
    });
  }

  describe('obterToken', () => {
    test('autentica e retorna o access_token', async () => {
      mockAuthOk();

      const token = await syncpayService.obterToken();

      expect(token).toBe('token-fake');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.syncpay.test/api/partner/v1/auth-token',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ client_id: 'client-teste', client_secret: 'secret-teste' }),
        })
      );
    });

    test('reaproveita o token em cache em vez de autenticar de novo', async () => {
      mockAuthOk();

      await syncpayService.obterToken();
      const token2 = await syncpayService.obterToken();

      expect(token2).toBe('token-fake');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('autentica de novo quando o token em cache ja expirou', async () => {
      const agora = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(agora);
      mockAuthOk(60);

      await syncpayService.obterToken();

      Date.now.mockReturnValue(agora + 61 * 1000);
      mockAuthOk(60);

      await syncpayService.obterToken();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      Date.now.mockRestore();
    });

    test('lanca erro quando a autenticacao falha', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 401 });

      await expect(syncpayService.obterToken()).rejects.toThrow(/status 401/);
    });
  });

  describe('criarCobrancaPix', () => {
    test('autentica e cria a cobranca, retornando pixCode e identifier', async () => {
      mockAuthOk();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pix_code: '00020126...', identifier: 'tx-123' }),
      });

      const resultado = await syncpayService.criarCobrancaPix({
        valor: 49.9,
        descricao: 'Plano Pro',
        cliente: { name: 'Fulano', email: 'fulano@teste.com', cpf: '11111111111' },
        webhookUrl: 'https://zync.test/webhook',
      });

      expect(resultado).toEqual({ pixCode: '00020126...', identifier: 'tx-123' });
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'https://api.syncpay.test/api/partner/v1/cash-in',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer token-fake' }),
          body: JSON.stringify({
            amount: 49.9,
            description: 'Plano Pro',
            webhook_url: 'https://zync.test/webhook',
            client: { name: 'Fulano', email: 'fulano@teste.com', cpf: '11111111111' },
          }),
        })
      );
    });

    test('lanca o erro com a mensagem da SyncPay quando a cobranca falha', async () => {
      mockAuthOk();
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'CPF invalido' }),
      });

      await expect(
        syncpayService.criarCobrancaPix({ valor: 10, descricao: 'x', cliente: {}, webhookUrl: 'x' })
      ).rejects.toThrow('CPF invalido');
    });

    test('cai na mensagem generica quando o erro nao vem em JSON', async () => {
      mockAuthOk();
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('corpo vazio'); },
      });

      await expect(
        syncpayService.criarCobrancaPix({ valor: 10, descricao: 'x', cliente: {}, webhookUrl: 'x' })
      ).rejects.toThrow(/status 500/);
    });
  });

  describe('consultarTransacao', () => {
    test('autentica e retorna os dados da transacao', async () => {
      mockAuthOk();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'paid', identifier: 'tx-123' } }),
      });

      const dados = await syncpayService.consultarTransacao('tx-123');

      expect(dados).toEqual({ status: 'paid', identifier: 'tx-123' });
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'https://api.syncpay.test/api/partner/v1/transaction/tx-123',
        expect.objectContaining({ headers: { Authorization: 'Bearer token-fake' } })
      );
    });

    test('lanca erro quando a consulta falha', async () => {
      mockAuthOk();
      global.fetch.mockResolvedValueOnce({ ok: false, status: 404 });

      await expect(syncpayService.consultarTransacao('tx-inexistente')).rejects.toThrow(/status 404/);
    });
  });
});
