USE zync;

CREATE TABLE IF NOT EXISTS agendamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  lead_id INT NOT NULL,
  servico VARCHAR(120),
  data_hora DATETIME NOT NULL,
  status ENUM('agendado', 'confirmado', 'cancelado', 'concluido') DEFAULT 'agendado',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
