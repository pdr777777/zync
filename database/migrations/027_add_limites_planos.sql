-- Limites de uso por plano (leads e mensagens por mes). NULL = ilimitado.
-- So usado pra contar e avisar o dono da conta quando passar do limite --
-- nao bloqueia nenhum acesso (decisao consciente, pra nunca deixar o
-- cliente final sem resposta so porque o plano do dono da conta esgotou).
ALTER TABLE planos
  ADD COLUMN IF NOT EXISTS limite_leads_mes INT NULL,
  ADD COLUMN IF NOT EXISTS limite_mensagens_mes INT NULL;

UPDATE planos SET limite_leads_mes = 100, limite_mensagens_mes = 200 WHERE nome = 'Starter';
