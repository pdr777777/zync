USE zync;

UPDATE planos SET ativo = 0 WHERE nome = 'Pro' AND intervalo_dias = 30 AND preco = 99.90;

INSERT INTO planos (nome, preco, intervalo_dias) VALUES
  ('Pro Mensal', 247.00, 30),
  ('Pro Trimestral', 666.90, 90),
  ('Pro Semestral', 1259.70, 180),
  ('Pro Anual', 2223.00, 365);
