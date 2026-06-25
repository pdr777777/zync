require('dotenv').config();
require('./config/sentry');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const db = require('./config/db');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { tratarErro, rotaNaoEncontrada } = require('./middleware/errorMiddleware');
const frontendUrl = require('./utils/frontendUrl');

const app = express();

const ORIGENS_PERMITIDAS = [
  ...frontendUrl.listarUrls(),
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ORIGENS_PERMITIDAS.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('Origem não permitida pelo CORS'));
    },
  })
);
app.use(express.json({
  limit: '3mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'erro', detalhe: 'banco de dados indisponível' });
  }
});

app.use('/api', apiLimiter, routes);
app.use(rotaNaoEncontrada);
app.use(tratarErro);

module.exports = app;
