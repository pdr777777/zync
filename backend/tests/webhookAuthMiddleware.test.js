const verificarTokenWebhook = require('../src/middleware/webhookAuthMiddleware');

const ENV_VAR = 'TOKEN_TESTE_MIDDLEWARE';

function criarResMock() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('webhookAuthMiddleware', () => {
  afterEach(() => {
    delete process.env[ENV_VAR];
  });

  test('bloqueia (503) se a env var do token não estiver configurada', () => {
    const middleware = verificarTokenWebhook(ENV_VAR);
    const req = { headers: {} };
    const res = criarResMock();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  test('bloqueia (401) com token errado', () => {
    process.env[ENV_VAR] = 'segredo';
    const middleware = verificarTokenWebhook(ENV_VAR);
    const req = { headers: { authorization: 'Bearer errado' } };
    const res = criarResMock();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('libera com o token correto', () => {
    process.env[ENV_VAR] = 'segredo';
    const middleware = verificarTokenWebhook(ENV_VAR);
    const req = { headers: { authorization: 'Bearer segredo' } };
    const res = criarResMock();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
