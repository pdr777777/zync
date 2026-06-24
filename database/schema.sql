CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reset_token_hash VARCHAR(64),
  reset_token_expira TIMESTAMP,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  senha_alterada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_usuarios_reset_token ON usuarios (reset_token_hash);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  nome VARCHAR(120) NOT NULL,
  servico VARCHAR(120),
  origem VARCHAR(60),
  telefone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'novo' CHECK (status IN ('novo', 'em_contato', 'proposta_enviada', 'fechado')),
  valor DECIMAL(10,2),
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fechado_em TIMESTAMP,
  UNIQUE (usuario_id, telefone)
);
CREATE INDEX IF NOT EXISTS idx_leads_usuario_criado ON leads (usuario_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_leads_usuario_status_fechado ON leads (usuario_id, status, fechado_em);

CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  enviado_por VARCHAR(20) NOT NULL CHECK (enviado_por IN ('ia', 'humano', 'cliente')),
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mensagens_lead_criado ON mensagens (lead_id, criado_em);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  nome VARCHAR(60) NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (usuario_id, nome)
);

CREATE TABLE IF NOT EXISTS lead_tags (
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  servico VARCHAR(120),
  data_hora TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'agendado' CHECK (status IN ('agendado', 'confirmado', 'cancelado', 'concluido')),
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_data ON agendamentos (usuario_id, data_hora);

CREATE TABLE IF NOT EXISTS logs_atividade (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  acao VARCHAR(60) NOT NULL,
  detalhes JSONB,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_logs_usuario_criado ON logs_atividade (usuario_id, criado_em);

CREATE TABLE IF NOT EXISTS notificacoes (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  tipo VARCHAR(40) NOT NULL,
  mensagem VARCHAR(255) NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_lida_criado ON notificacoes (usuario_id, lida, criado_em);

CREATE TABLE IF NOT EXISTS planos (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome VARCHAR(60) NOT NULL,
  preco DECIMAL(10,2) NOT NULL,
  intervalo_dias INTEGER NOT NULL DEFAULT 30,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assinaturas (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  plano_id INTEGER NOT NULL REFERENCES planos(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ativa', 'cancelada', 'expirada')),
  syncpay_identifier VARCHAR(60) UNIQUE,
  pix_code TEXT,
  valor DECIMAL(10,2) NOT NULL,
  expira_em TIMESTAMP,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assinaturas_atualizado_em ON assinaturas;
CREATE TRIGGER trg_assinaturas_atualizado_em
BEFORE UPDATE ON assinaturas
FOR EACH ROW
EXECUTE FUNCTION set_atualizado_em();
