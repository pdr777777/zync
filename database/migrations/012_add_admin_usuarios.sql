USE zync;

ALTER TABLE usuarios ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE usuarios SET is_admin = 1 WHERE email IN (
  'andre23mats@gmail.com',
  'pedrohenriquesilvadeoliveira8@gmail.com',
  'herosbritocandido.cg@gmail.com'
);
