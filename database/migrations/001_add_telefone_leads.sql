USE zync;

ALTER TABLE leads ADD COLUMN telefone VARCHAR(20) AFTER origem;
CREATE UNIQUE INDEX idx_leads_usuario_telefone ON leads (usuario_id, telefone);
