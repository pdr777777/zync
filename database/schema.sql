-- Schema PostgreSQL (Supabase). Substitui a versao MySQL anterior.
-- No Supabase nao se cria "database" nem se roda USE: cada projeto ja e um
-- banco Postgres unico, e as tabelas ficam no schema "public" por padrao.

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  reset_token_hash VARCHAR(64) NULL,
  reset_token_expira TIMESTAMPTZ NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  foto_url TEXT NULL,
  idade INT NULL,
  cpf VARCHAR(14) NULL,
  instagram VARCHAR(120) NULL,
  facebook VARCHAR(120) NULL,
  telefone VARCHAR(20) NULL,
  nome_empresa VARCHAR(120) NULL,
  senha_alterada_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  catalogo_slug VARCHAR(32) NULL UNIQUE,
  removido_em TIMESTAMPTZ NULL,
  whatsapp_phone_number_id VARCHAR(60) NULL UNIQUE,
  ia_o_que_vende TEXT NULL,
  ia_horario_funcionamento VARCHAR(200) NULL,
  ia_tom_de_voz VARCHAR(20) NULL DEFAULT 'amigavel'
    CHECK (ia_tom_de_voz IN ('formal', 'casual', 'amigavel')),
  nps_dispensado_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_usuarios_reset_token ON usuarios (reset_token_hash);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  nome VARCHAR(120) NOT NULL,
  servico VARCHAR(120),
  origem VARCHAR(60),
  telefone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'novo' CHECK (status IN ('novo', 'em_contato', 'proposta_enviada', 'fechado')),
  valor DECIMAL(10,2),
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  fechado_em TIMESTAMPTZ NULL,
  CONSTRAINT idx_leads_usuario_telefone UNIQUE (usuario_id, telefone)
);

CREATE INDEX IF NOT EXISTS idx_leads_usuario_criado ON leads (usuario_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_leads_usuario_status_fechado ON leads (usuario_id, status, fechado_em);

CREATE TABLE IF NOT EXISTS mensagens (
  id SERIAL PRIMARY KEY,
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  conteudo TEXT NULL,
  enviado_por VARCHAR(20) NOT NULL CHECK (enviado_por IN ('ia', 'humano', 'cliente')),
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tipo VARCHAR(20) NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagem', 'documento')),
  midia_id VARCHAR(100) NULL,
  midia_mime_type VARCHAR(100) NULL
);

CREATE INDEX IF NOT EXISTS idx_mensagens_lead_criado ON mensagens (lead_id, criado_em);

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  nome VARCHAR(60) NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT idx_tags_usuario_nome UNIQUE (usuario_id, nome)
);

CREATE TABLE IF NOT EXISTS lead_tags (
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag_id INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);

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

CREATE TABLE IF NOT EXISTS agendamentos (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  servico VARCHAR(120),
  data_hora TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'agendado' CHECK (status IN ('agendado', 'confirmado', 'cancelado', 'concluido')),
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  lembrete_enviado_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_data ON agendamentos (usuario_id, data_hora);
-- Indice parcial pro job de lembrete (lembreteAgendamentoJob.js), que varre
-- TODOS os tenants buscando agendamentos proximos ainda sem lembrete - nao
-- e filtrado por usuario_id, entao o indice acima nao ajuda nessa consulta.
CREATE INDEX IF NOT EXISTS idx_agendamentos_lembrete_pendente ON agendamentos (data_hora)
  WHERE status = 'agendado' AND lembrete_enviado_em IS NULL;

CREATE TABLE IF NOT EXISTS logs_atividade (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  lead_id INT REFERENCES leads(id) ON DELETE SET NULL,
  acao VARCHAR(60) NOT NULL,
  detalhes JSONB,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logs_usuario_criado ON logs_atividade (usuario_id, criado_em);

CREATE TABLE IF NOT EXISTS notificacoes (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
  tipo VARCHAR(40) NOT NULL,
  mensagem VARCHAR(255) NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_lida_criado ON notificacoes (usuario_id, lida, criado_em);
-- Cobre existeDoTipoNoMes (usoService.verificarLimitesEAvisar), chamada a
-- cada lead/mensagem criada e a cada campanha disparada.
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_tipo_criado ON notificacoes (usuario_id, tipo, criado_em);

CREATE TABLE IF NOT EXISTS planos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(60) NOT NULL,
  preco DECIMAL(10,2) NOT NULL,
  intervalo_dias INT NOT NULL DEFAULT 30,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  limite_leads_mes INT NULL,
  limite_mensagens_mes INT NULL
);

CREATE TABLE IF NOT EXISTS assinaturas (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  plano_id INT NOT NULL REFERENCES planos(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ativa', 'cancelada', 'expirada')),
  syncpay_identifier VARCHAR(60),
  pix_code TEXT,
  valor DECIMAL(10,2) NOT NULL,
  expira_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT idx_assinaturas_syncpay_identifier UNIQUE (syncpay_identifier)
);

-- Postgres nao tem "ON UPDATE CURRENT_TIMESTAMP" inline como o MySQL,
-- por isso atualizado_em precisa de uma trigger pra se atualizar so.
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assinaturas_atualizado_em ON assinaturas;
CREATE TRIGGER trg_assinaturas_atualizado_em
  BEFORE UPDATE ON assinaturas
  FOR EACH ROW
  EXECUTE FUNCTION set_atualizado_em();

CREATE TABLE IF NOT EXISTS mensagens_suporte (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mensagem TEXT NOT NULL,
  video_url VARCHAR(500),
  respondida BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhooks (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  eventos JSONB NOT NULL DEFAULT '[]',
  secret VARCHAR(64) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhooks_usuario ON webhooks (usuario_id);

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

-- Programa de afiliados: comissao recorrente (% sobre cada pagamento
-- confirmado de quem foi indicado).
CREATE TABLE IF NOT EXISTS afiliados (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  percentual_comissao DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT idx_afiliados_usuario_unico UNIQUE (usuario_id)
);

-- So pode ser adicionada depois que "afiliados" existe (referencia ele).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS indicado_por_afiliado_id INT NULL REFERENCES afiliados(id);

CREATE TABLE IF NOT EXISTS comissoes_afiliado (
  id SERIAL PRIMARY KEY,
  afiliado_id INT NOT NULL REFERENCES afiliados(id) ON DELETE CASCADE,
  usuario_indicado_id INT NOT NULL REFERENCES usuarios(id),
  assinatura_id INT NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
  valor DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'paga')),
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT idx_comissoes_assinatura_unica UNIQUE (assinatura_id)
);

CREATE INDEX IF NOT EXISTS idx_comissoes_afiliado_status ON comissoes_afiliado (afiliado_id, status);

-- Contagem de rate limit (ver backend/src/middleware/postgresRateLimitStore.js).
-- Fica no Postgres em vez de em memoria pra funcionar com mais de uma
-- instancia do backend rodando ao mesmo tempo, sem precisar de Redis.
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  chave VARCHAR(150) PRIMARY KEY,
  contagem INT NOT NULL DEFAULT 1,
  expira_em TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_expira ON rate_limit_hits (expira_em);

-- NPS simples dentro do produto.
CREATE TABLE IF NOT EXISTS pesquisas_nps (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nota INT NOT NULL CHECK (nota BETWEEN 0 AND 10),
  comentario VARCHAR(500),
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pesquisas_nps_usuario ON pesquisas_nps (usuario_id);

-- RLS em todas as tabelas. O backend conecta direto como usuario "postgres"
-- (table owner), que sempre ignora RLS - entao isso nao afeta o backend. O
-- efeito e fechar a API publica do Supabase (PostgREST/anon key), que
-- ficaria liberada por padrao em qualquer tabela sem isso. Antes desse bloco
-- entrar aqui, RLS só existia como migration aplicada manualmente na
-- produção (017_enable_rls.sql) - um setup novo (staging, banco local,
-- restore de backup) ficava sem nenhuma proteção.
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE campos_personalizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_campos_valores ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_atividade ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_suporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE afiliados ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes_afiliado ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesquisas_nps ENABLE ROW LEVEL SECURITY;
