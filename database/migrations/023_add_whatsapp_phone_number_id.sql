-- Identifica qual usuario (tenant) e dono de qual numero do WhatsApp
-- Business, pra resolver o webhook real da Meta (que chama uma unica URL
-- pra todos os tenants, identificando o numero via phone_number_id no
-- corpo da mensagem, nao por usuarioId na URL).
ALTER TABLE usuarios ADD COLUMN whatsapp_phone_number_id VARCHAR(60) NULL UNIQUE;
