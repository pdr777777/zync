-- Catalogo de produtos (feature de e-commerce/marketplaces): cada usuario
-- cadastra produtos e compartilha um link publico (via slug) onde o cliente
-- final pode solicitar um produto, o que cria um lead automaticamente.

CREATE TABLE IF NOT EXISTS produtos (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome VARCHAR(120) NOT NULL,
  descricao VARCHAR(500),
  preco DECIMAL(10,2) NOT NULL,
  foto_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_produtos_usuario ON produtos (usuario_id);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS catalogo_slug VARCHAR(32) UNIQUE;
