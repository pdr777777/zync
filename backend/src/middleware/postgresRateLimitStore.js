const db = require('../config/db');

// Store do express-rate-limit (https://express-rate-limit.mintlify.app/guides/creating-a-store)
// gravando a contagem no Postgres em vez de em memoria, pra continuar
// funcionando corretamente se um dia o backend rodar em mais de uma
// instancia ao mesmo tempo (em memoria, cada instancia teria seu proprio
// contador e o limite real seria N vezes maior que o configurado).
class PostgresRateLimitStore {
  constructor(prefixo) {
    this.prefixo = prefixo;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  prefixedKey(key) {
    return `${this.prefixo}:${key}`;
  }

  async increment(key) {
    const chave = this.prefixedKey(key);

    if (Math.random() < 0.001) {
      db.query("DELETE FROM rate_limit_hits WHERE expira_em < NOW() - INTERVAL '1 day'").catch(() => {});
    }

    const { rows } = await db.query(
      `INSERT INTO rate_limit_hits (chave, contagem, expira_em)
       VALUES ($1, 1, NOW() + $2 * INTERVAL '1 millisecond')
       ON CONFLICT (chave) DO UPDATE SET
         contagem = CASE WHEN rate_limit_hits.expira_em < NOW() THEN 1 ELSE rate_limit_hits.contagem + 1 END,
         expira_em = CASE WHEN rate_limit_hits.expira_em < NOW() THEN NOW() + $2 * INTERVAL '1 millisecond' ELSE rate_limit_hits.expira_em END
       RETURNING contagem, expira_em`,
      [chave, this.windowMs]
    );

    return { totalHits: rows[0].contagem, resetTime: rows[0].expira_em };
  }

  async decrement(key) {
    await db.query('UPDATE rate_limit_hits SET contagem = GREATEST(0, contagem - 1) WHERE chave = $1', [this.prefixedKey(key)]);
  }

  async resetKey(key) {
    await db.query('DELETE FROM rate_limit_hits WHERE chave = $1', [this.prefixedKey(key)]);
  }
}

module.exports = PostgresRateLimitStore;
