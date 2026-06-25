const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const skipEmTeste = () => process.env.NODE_ENV === 'test';

function keyPorUsuarioOuIp(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.decode(header.split(' ')[1]);
      if (decoded && decoded.id) return `user:${decoded.id}`;
    } catch (_) {
      // token ilegível pra rate limit não é problema — só cai pro IP abaixo.
      // A validação de verdade do token acontece no authMiddleware de cada rota.
    }
  }
  return ipKeyGenerator(req.ip);
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipEmTeste,
  keyGenerator: keyPorUsuarioOuIp,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipEmTeste,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipEmTeste,
  message: { error: 'Muitas requisições. Tente novamente em breve.' },
});

const catalogoPublicoLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipEmTeste,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});

module.exports = { authLimiter, webhookLimiter, apiLimiter, catalogoPublicoLimiter };
