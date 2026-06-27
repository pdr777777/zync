const db = require('../src/config/db');
const PostgresRateLimitStore = require('../src/middleware/postgresRateLimitStore');

afterAll(async () => {
  await db.end();
});

afterEach(async () => {
  await db.query('DELETE FROM rate_limit_hits');
});

describe('PostgresRateLimitStore', () => {
  test('increment cria a chave com contagem 1 na primeira chamada', async () => {
    const store = new PostgresRateLimitStore('teste');
    store.init({ windowMs: 60000 });

    const resultado = await store.increment('chave-1');

    expect(resultado.totalHits).toBe(1);

    const { rows } = await db.query('SELECT * FROM rate_limit_hits WHERE chave = $1', ['teste:chave-1']);
    expect(rows).toHaveLength(1);
  });

  test('increment soma a contagem pra mesma chave dentro da janela', async () => {
    const store = new PostgresRateLimitStore('teste');
    store.init({ windowMs: 60000 });

    await store.increment('chave-1');
    await store.increment('chave-1');
    const resultado = await store.increment('chave-1');

    expect(resultado.totalHits).toBe(3);
  });

  test('prefixos diferentes nao compartilham contagem pra mesma chave', async () => {
    const storeA = new PostgresRateLimitStore('a');
    const storeB = new PostgresRateLimitStore('b');
    storeA.init({ windowMs: 60000 });
    storeB.init({ windowMs: 60000 });

    await storeA.increment('chave-1');
    await storeA.increment('chave-1');
    const resultadoB = await storeB.increment('chave-1');

    expect(resultadoB.totalHits).toBe(1);
  });

  test('reseta a contagem pra 1 quando a janela ja expirou', async () => {
    const store = new PostgresRateLimitStore('teste');
    store.init({ windowMs: 60000 });
    await store.increment('chave-1');

    await db.query("UPDATE rate_limit_hits SET expira_em = NOW() - INTERVAL '1 minute' WHERE chave = 'teste:chave-1'");

    const resultado = await store.increment('chave-1');
    expect(resultado.totalHits).toBe(1);
  });

  test('decrement reduz a contagem sem deixar negativo', async () => {
    const store = new PostgresRateLimitStore('teste');
    store.init({ windowMs: 60000 });
    await store.increment('chave-1');

    await store.decrement('chave-1');
    await store.decrement('chave-1');

    const { rows } = await db.query('SELECT contagem FROM rate_limit_hits WHERE chave = $1', ['teste:chave-1']);
    expect(rows[0].contagem).toBe(0);
  });

  test('resetKey remove a chave por completo', async () => {
    const store = new PostgresRateLimitStore('teste');
    store.init({ windowMs: 60000 });
    await store.increment('chave-1');

    await store.resetKey('chave-1');

    const { rows } = await db.query('SELECT * FROM rate_limit_hits WHERE chave = $1', ['teste:chave-1']);
    expect(rows).toHaveLength(0);
  });
});
