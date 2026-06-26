-- Suporte a rate limit distribuido (varias instancias do backend) sem
-- precisar de Redis: a contagem fica no mesmo Postgres que o resto da
-- aplicacao ja usa. Ver backend/src/middleware/postgresRateLimitStore.js.

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  chave VARCHAR(150) PRIMARY KEY,
  contagem INT NOT NULL DEFAULT 1,
  expira_em TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_expira ON rate_limit_hits (expira_em);
