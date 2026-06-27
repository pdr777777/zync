const Sentry = require('../config/sentry');
const logger = require('../utils/logger');

function tratarErro(err, req, res, next) {
  logger.error('Erro nao tratado', err, { path: req.path, method: req.method });

  if (err.code === 'ECONNREFUSED') {
    Sentry.captureException(err);
    return res.status(503).json({ error: 'Banco de dados indisponível, tente novamente em breve' });
  }

  if (err.code === '23505') {
    return res.status(409).json({ error: 'Registro duplicado' });
  }

  if (err.message === 'Origem não permitida pelo CORS') {
    return res.status(403).json({ error: err.message });
  }

  if (err.code === 'LIMIT_FILE_SIZE' || err.message === 'Tipo de arquivo não suportado') {
    return res.status(400).json({ error: err.message });
  }

  Sentry.captureException(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

function rotaNaoEncontrada(req, res) {
  res.status(404).json({ error: 'Rota não encontrada' });
}

module.exports = { tratarErro, rotaNaoEncontrada };
