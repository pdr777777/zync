const dashboardModel = require('../models/dashboardModel');
const asyncHandler = require('../utils/asyncHandler');

async function obterMetricas(req, res) {
  const usuarioId = req.usuario.id;

  const [leadsHoje, conversoes, mensagensEnviadas, taxaRespostaIA, leadsPorStatus] = await Promise.all([
    dashboardModel.leadsHoje(usuarioId),
    dashboardModel.totalConversoes(usuarioId),
    dashboardModel.mensagensEnviadas(usuarioId),
    dashboardModel.taxaRespostaIA(usuarioId),
    dashboardModel.leadsPorStatus(usuarioId),
  ]);

  res.json({ leadsHoje, conversoes, mensagensEnviadas, taxaRespostaIA, leadsPorStatus });
}

module.exports = { obterMetricas: asyncHandler(obterMetricas) };
