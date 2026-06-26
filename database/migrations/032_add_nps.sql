-- NPS simples dentro do produto: pergunta uma vez, 30 dias depois do
-- cadastro, e nao insiste se a pessoa ja respondeu ou dispensou.

CREATE TABLE IF NOT EXISTS pesquisas_nps (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nota INT NOT NULL CHECK (nota BETWEEN 0 AND 10),
  comentario VARCHAR(500),
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pesquisas_nps_usuario ON pesquisas_nps (usuario_id);

ALTER TABLE usuarios ADD COLUMN nps_dispensado_em TIMESTAMPTZ NULL;
