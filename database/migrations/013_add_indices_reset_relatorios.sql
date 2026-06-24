USE zync;

ALTER TABLE usuarios ADD INDEX idx_usuarios_reset_token (reset_token_hash);
ALTER TABLE leads ADD INDEX idx_leads_usuario_status_fechado (usuario_id, status, fechado_em);
