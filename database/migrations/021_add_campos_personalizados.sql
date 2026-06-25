-- Campos personalizados em leads: cada usuario define campos extras
-- proprios (texto, numero, data ou selecao) que passam a aparecer no
-- painel de qualquer lead, com valor independente por lead.

CREATE TABLE IF NOT EXISTS campos_personalizados (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome VARCHAR(60) NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('texto', 'numero', 'data', 'selecao')),
  opcoes JSONB,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT idx_campos_personalizados_usuario_nome UNIQUE (usuario_id, nome)
);

CREATE TABLE IF NOT EXISTS lead_campos_valores (
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  campo_id INT NOT NULL REFERENCES campos_personalizados(id) ON DELETE CASCADE,
  valor TEXT,
  PRIMARY KEY (lead_id, campo_id)
);
