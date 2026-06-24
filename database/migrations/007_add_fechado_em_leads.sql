USE zync;

ALTER TABLE leads ADD COLUMN fechado_em DATETIME NULL;

UPDATE leads SET fechado_em = criado_em WHERE status = 'fechado' AND fechado_em IS NULL;
