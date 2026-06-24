CREATE DATABASE IF NOT EXISTS zync;
USE zync;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  servico VARCHAR(120),
  origem VARCHAR(60),
  telefone VARCHAR(20),
  status ENUM('novo', 'em_contato', 'proposta_enviada', 'fechado') DEFAULT 'novo',
  valor DECIMAL(10,2),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  UNIQUE KEY idx_leads_usuario_telefone (usuario_id, telefone)
);

CREATE TABLE IF NOT EXISTS mensagens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lead_id INT NOT NULL,
  conteudo TEXT NOT NULL,
  enviado_por ENUM('ia', 'humano', 'cliente') NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
