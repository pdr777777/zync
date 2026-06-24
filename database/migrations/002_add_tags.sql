USE zync;

CREATE TABLE IF NOT EXISTS tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  nome VARCHAR(60) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  UNIQUE KEY idx_tags_usuario_nome (usuario_id, nome)
);

CREATE TABLE IF NOT EXISTS lead_tags (
  lead_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (lead_id, tag_id),
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);
