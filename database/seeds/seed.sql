INSERT INTO usuarios (nome, email, senha_hash) VALUES
  ('Admin Zync', 'admin@zync.com.br', 'troque_este_hash');

INSERT INTO leads (usuario_id, nome, servico, origem, status, valor) VALUES
  (1, 'Maria Souza', 'Implante dental', 'WhatsApp', 'novo', NULL),
  (1, 'Pedro Rocha', 'Prótese total', 'Site', 'proposta_enviada', 4800.00);
