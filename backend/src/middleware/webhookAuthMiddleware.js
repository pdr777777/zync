const crypto = require('crypto');

function verificarTokenWebhook(envVar) {
  return function (req, res, next) {
    const tokenEsperado = process.env[envVar];

    if (!tokenEsperado) {
      console.error(`${envVar} não configurada — bloqueando webhook por segurança`);
      return res.status(503).json({ error: 'Webhook não configurado' });
    }

    const esperado = Buffer.from(`Bearer ${tokenEsperado}`);
    const recebido = Buffer.from(req.headers.authorization || '');
    const valido = esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);

    if (!valido) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    next();
  };
}

module.exports = verificarTokenWebhook;
