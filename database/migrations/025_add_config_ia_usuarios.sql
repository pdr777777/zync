-- Configuracao da IA de atendimento por empresa: sem isso, a IA respondia
-- com um prompt generico igual pra todo mundo, sem saber o que a empresa
-- vende, o horario de funcionamento ou o tom de voz desejado.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ia_o_que_vende TEXT NULL,
  ADD COLUMN IF NOT EXISTS ia_horario_funcionamento VARCHAR(200) NULL,
  ADD COLUMN IF NOT EXISTS ia_tom_de_voz VARCHAR(20) NULL DEFAULT 'amigavel'
    CHECK (ia_tom_de_voz IN ('formal', 'casual', 'amigavel'));
