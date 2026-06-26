const leadModel = require('../models/leadModel');
const logModel = require('../models/logModel');
const notificacaoModel = require('../models/notificacaoModel');
const webhookService = require('../services/webhookService');
const usoService = require('../services/usoService');
const asyncHandler = require('../utils/asyncHandler');
const validators = require('../utils/validators');
const { paraCsv, deCsv } = require('../utils/csv');

const COLUNAS_EXPORT = ['id', 'nome', 'servico', 'origem', 'telefone', 'status', 'valor', 'criado_em'];
const MAX_LEADS_POR_IMPORTACAO = 1000;

function validarStatusEValor(dados) {
  if (dados.status !== undefined && !validators.STATUS_LEAD.includes(dados.status)) {
    return `status deve ser um de: ${validators.STATUS_LEAD.join(', ')}`;
  }

  if (dados.valor !== undefined && dados.valor !== null && !validators.valorPositivo(dados.valor)) {
    return 'valor deve ser um número positivo';
  }

  if (!validators.dentroDoTamanho(dados.nome, 120)) return 'nome deve ter no máximo 120 caracteres';
  if (!validators.dentroDoTamanho(dados.servico, 120)) return 'servico deve ter no máximo 120 caracteres';
  if (!validators.dentroDoTamanho(dados.origem, 60)) return 'origem deve ter no máximo 60 caracteres';
  if (!validators.dentroDoTamanho(dados.telefone, 20)) return 'telefone deve ter no máximo 20 caracteres';

  return null;
}

function validarFiltros(query) {
  if (query.status !== undefined && !validators.STATUS_LEAD.includes(query.status)) {
    return `status deve ser um de: ${validators.STATUS_LEAD.join(', ')}`;
  }

  if (query.valorMin !== undefined && !validators.valorPositivo(query.valorMin)) {
    return 'valorMin deve ser um número positivo';
  }

  if (query.valorMax !== undefined && !validators.valorPositivo(query.valorMax)) {
    return 'valorMax deve ser um número positivo';
  }

  return null;
}

async function listar(req, res) {
  const erro = validarFiltros(req.query);
  if (erro) return res.status(400).json({ error: erro });

  const { tagId, busca, status, origem, valorMin, valorMax, page, limit } = req.query;
  const leads = await leadModel.listarPorUsuario(req.usuario.id, {
    tagId,
    busca,
    status,
    origem,
    valorMin,
    valorMax,
    page,
    limit,
  });
  res.json(leads);
}

async function inbox(req, res) {
  const leads = await leadModel.listarInbox(req.usuario.id);
  res.json(leads);
}

async function exportarCsv(req, res) {
  const erro = validarFiltros(req.query);
  if (erro) return res.status(400).json({ error: erro });

  const { tagId, busca, status, origem, valorMin, valorMax } = req.query;
  const leads = await leadModel.listarPorUsuario(req.usuario.id, {
    tagId,
    busca,
    status,
    origem,
    valorMin,
    valorMax,
  });
  const csv = paraCsv(leads, COLUNAS_EXPORT);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
  res.send(csv);
}

async function buscar(req, res) {
  const lead = await leadModel.buscarPorId(req.params.id, req.usuario.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
  res.json(lead);
}

async function criar(req, res) {
  const { nome, servico, origem, telefone, status, valor } = req.body;
  if (!nome) return res.status(400).json({ error: 'nome é obrigatório' });

  const erro = validarStatusEValor(req.body);
  if (erro) return res.status(400).json({ error: erro });

  const lead = await leadModel.criar({ usuarioId: req.usuario.id, nome, servico, origem, telefone, status, valor });

  await logModel.registrar({
    usuarioId: req.usuario.id,
    leadId: lead.id,
    acao: 'lead_criado',
    detalhes: { nome: lead.nome },
  });

  await notificacaoModel.criar({
    usuarioId: req.usuario.id,
    leadId: lead.id,
    tipo: 'lead_criado',
    mensagem: `Novo lead: ${lead.nome}`,
  });

  webhookService.disparar(req.usuario.id, 'lead_criado', {
    id: lead.id,
    nome: lead.nome,
    servico: lead.servico,
    origem: lead.origem,
    status: lead.status,
  });

  await usoService.verificarLimitesEAvisar(req.usuario.id);

  res.status(201).json(lead);
}

async function atualizar(req, res) {
  const lead = await leadModel.buscarPorId(req.params.id, req.usuario.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  const erro = validarStatusEValor(req.body);
  if (erro) return res.status(400).json({ error: erro });

  const atualizado = await leadModel.atualizar(req.params.id, req.usuario.id, req.body);

  if (req.body.status !== undefined && req.body.status !== lead.status) {
    await logModel.registrar({
      usuarioId: req.usuario.id,
      leadId: lead.id,
      acao: 'lead_status_alterado',
      detalhes: { de: lead.status, para: req.body.status },
    });

    webhookService.disparar(req.usuario.id, 'lead_status_alterado', {
      id: lead.id,
      nome: lead.nome,
      de: lead.status,
      para: req.body.status,
    });
  }

  res.json(atualizado);
}

async function remover(req, res) {
  const lead = await leadModel.buscarPorId(req.params.id, req.usuario.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  await leadModel.remover(req.params.id, req.usuario.id);
  res.status(204).send();
}

async function importar(req, res) {
  const { csv } = req.body;
  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: 'csv é obrigatório' });
  }

  const linhas = deCsv(csv);
  if (linhas.length === 0) {
    return res.status(400).json({ error: 'CSV vazio ou sem linhas de dados' });
  }
  if (linhas.length > MAX_LEADS_POR_IMPORTACAO) {
    return res.status(400).json({ error: `Máximo de ${MAX_LEADS_POR_IMPORTACAO} leads por importação` });
  }

  const resultado = { importados: 0, erros: [] };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const numeroDaLinha = i + 2;

    if (!linha.nome) {
      resultado.erros.push({ linha: numeroDaLinha, motivo: 'nome é obrigatório' });
      continue;
    }

    const dados = {
      nome: linha.nome,
      servico: linha.servico || null,
      origem: linha.origem || null,
      telefone: linha.telefone || null,
      status: linha.status || undefined,
      valor: linha.valor ? Number(linha.valor) : null,
    };

    const erro = validarStatusEValor(dados);
    if (erro) {
      resultado.erros.push({ linha: numeroDaLinha, motivo: erro });
      continue;
    }

    try {
      const lead = await leadModel.criar({ usuarioId: req.usuario.id, ...dados });
      resultado.importados++;

      webhookService.disparar(req.usuario.id, 'lead_criado', {
        id: lead.id,
        nome: lead.nome,
        servico: lead.servico,
        origem: lead.origem,
        status: lead.status,
      });
    } catch (err) {
      resultado.erros.push({ linha: numeroDaLinha, motivo: err.message });
    }
  }

  if (resultado.importados > 0) {
    await usoService.verificarLimitesEAvisar(req.usuario.id);
  }

  res.status(201).json(resultado);
}

module.exports = {
  listar: asyncHandler(listar),
  inbox: asyncHandler(inbox),
  exportarCsv: asyncHandler(exportarCsv),
  importar: asyncHandler(importar),
  buscar: asyncHandler(buscar),
  criar: asyncHandler(criar),
  atualizar: asyncHandler(atualizar),
  remover: asyncHandler(remover),
};
