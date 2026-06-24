const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const routes = require('./routes');
const { tratarErro, rotaNaoEncontrada } = require('./middleware/errorMiddleware');

const app = express();

const ORIGENS_PERMITIDAS = [
  process.env.FRONTEND_URL,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
].filter(Boolean);

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
app.use(express.json({ limit: '3mb' }));
app.use('/api', routes);
app.use(rotaNaoEncontrada);
app.use(tratarErro);

module.exports = app;
