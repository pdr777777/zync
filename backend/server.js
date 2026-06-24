const express = require('express');
const cors = require('cors');
require('dotenv').config();

const routes = require('./src/routes');
const { tratarErro, rotaNaoEncontrada } = require('./src/middleware/errorMiddleware');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', routes);
app.use(rotaNaoEncontrada);
app.use(tratarErro);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Zync API rodando na porta ${PORT}`);
});
