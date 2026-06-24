USE zync;

ALTER TABLE leads ADD INDEX idx_leads_usuario_criado (usuario_id, criado_em);
ALTER TABLE mensagens ADD INDEX idx_mensagens_lead_criado (lead_id, criado_em);
ALTER TABLE agendamentos ADD INDEX idx_agendamentos_usuario_data (usuario_id, data_hora);
ALTER TABLE logs_atividade ADD INDEX idx_logs_usuario_criado (usuario_id, criado_em);
ALTER TABLE notificacoes ADD INDEX idx_notificacoes_usuario_lida_criado (usuario_id, lida, criado_em);
ALTER TABLE assinaturas ADD UNIQUE INDEX idx_assinaturas_syncpay_identifier (syncpay_identifier);
