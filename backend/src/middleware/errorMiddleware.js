function tratarErro(err, req, res, next) {
  console.error(err);

  if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    return res.status(503).json({ error: 'Banco de dados indisponível, tente novamente em breve' });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Registro duplicado' });
  }

  res.status(500).json({ error: 'Erro interno do servidor' });
}

function rotaNaoEncontrada(req, res) {
  res.status(404).json({ error: 'Rota não encontrada' });
}

module.exports = { tratarErro, rotaNaoEncontrada };
