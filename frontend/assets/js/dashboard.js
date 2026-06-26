Auth.requireAuth();

const STATUS_LABEL_KEYS = {
  novo: 'dash.novoLead',
  em_contato: 'dash.colEmContato',
  proposta_enviada: 'dash.colPropostaEnviada',
  fechado: 'dash.colFechado',
};

function statusLabel(status) {
  return Lang.t(STATUS_LABEL_KEYS[status]) || status;
}

const SENDER_LABEL_KEYS = {
  cliente: 'dash.senderCliente',
  humano: 'dash.senderVoce',
  ia: 'dash.senderIa',
};

function senderLabel(enviadoPor) {
  const iconeNome = enviadoPor === 'ia' ? 'bot' : 'user';
  return `${icon(iconeNome, 12)} ${Lang.t(SENDER_LABEL_KEYS[enviadoPor]) || enviadoPor}`;
}

let leadsCache = [];
let currentLeadId = null;
let panelMode = 'humano';
let leadsFiltro = { termo: '', origem: '' };
let tagsCache = [];
let leadsTagFiltro = '';
let panelTagsCache = [];
let camposCache = [];
let panelCamposCache = [];

const TIPO_CAMPO_LABEL_KEYS = {
  texto: 'dash.tipoTexto',
  numero: 'dash.tipoNumero',
  data: 'dash.tipoData',
  selecao: 'dash.tipoSelecao',
};

function tipoCampoLabel(tipo) {
  return Lang.t(TIPO_CAMPO_LABEL_KEYS[tipo]) || tipo;
}
let cmdkItems = [];
let cmdkIndex = 0;

const STATUS_AGENDAMENTO_LABEL_KEYS = {
  agendado: 'dash.agAgendado',
  confirmado: 'dash.agConfirmado',
  cancelado: 'dash.agCancelado',
  concluido: 'dash.agConcluido',
};

function statusAgendamentoLabel(status) {
  return Lang.t(STATUS_AGENDAMENTO_LABEL_KEYS[status]) || status;
}

function formatMoeda(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* ---------- DASHBOARD STATS ---------- */
async function loadDashboard() {
  try {
    const data = await Api.dashboard();
    animateNumber(document.getElementById('stat-leads-hoje'), data.leadsHoje);
    animateNumber(document.getElementById('stat-conversoes'), data.conversoes);
    animateNumber(document.getElementById('stat-mensagens'), data.mensagensEnviadas);
    animateNumber(document.getElementById('stat-ia'), data.taxaRespostaIA, { formatar: (n) => `${Math.round(n)}%` });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ---------- KANBAN ---------- */
async function loadLeads() {
  try {
    leadsCache = await Api.leads.listar(leadsTagFiltro || undefined);
    popularFiltroOrigem();
    renderKanban();
    renderSparkline();
    renderOnboardingChecklist();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ---------- ONBOARDING ---------- */
async function renderOnboardingChecklist() {
  const card = document.getElementById('onboarding-checklist');

  if (localStorage.getItem('onboarding_dismissido') === 'true') {
    card.style.display = 'none';
    return;
  }

  let usuario;
  try {
    usuario = await Api.auth.me();
  } catch {
    card.style.display = 'none';
    return;
  }

  const passos = [
    { id: 'lead', label: Lang.t('dash.onboardingCriarLead'), feito: leadsCache.length > 0 },
    { id: 'ia', label: Lang.t('dash.onboardingConfigurarIa'), feito: !!usuario.ia_o_que_vende, href: 'configuracoes.html' },
    { id: 'whatsapp', label: Lang.t('dash.onboardingConectarWhatsapp'), feito: !!usuario.whatsapp_phone_number_id, href: 'configuracoes.html' },
  ];

  if (passos.every((p) => p.feito)) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  document.getElementById('onboarding-steps').innerHTML = passos.map((p) => `
    <li class="onboarding-step ${p.feito ? 'feito' : ''}">
      <span class="onboarding-check">${p.feito ? icon('check', 12) : ''}</span>
      ${p.href
        ? `<a href="${p.href}">${escapeHtml(p.label)}</a>`
        : `<button type="button" class="onboarding-link" data-passo="${p.id}">${escapeHtml(p.label)}</button>`}
    </li>
  `).join('');

  const btnCriarLead = document.querySelector('[data-passo="lead"]');
  if (btnCriarLead) btnCriarLead.addEventListener('click', abrirModal);
}

document.getElementById('onboarding-dismiss').addEventListener('click', () => {
  localStorage.setItem('onboarding_dismissido', 'true');
  document.getElementById('onboarding-checklist').style.display = 'none';
});

function leadsFiltrados() {
  const termo = leadsFiltro.termo.trim().toLowerCase();
  return leadsCache.filter((lead) => {
    if (leadsFiltro.origem && lead.origem !== leadsFiltro.origem) return false;
    if (!termo) return true;
    const alvo = [lead.nome, lead.servico, lead.origem, lead.telefone].filter(Boolean).join(' ').toLowerCase();
    return alvo.includes(termo);
  });
}

function popularFiltroOrigem() {
  const select = document.getElementById('kanban-filter-origem');
  const atual = select.value;
  const origens = [...new Set(leadsCache.map((l) => l.origem).filter(Boolean))].sort();
  select.innerHTML = `<option value="">${Lang.t('dash.todasOrigens')}</option>` + origens.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
  const novoValor = origens.includes(atual) ? atual : '';
  select.value = novoValor;
  leadsFiltro.origem = novoValor;
}

document.getElementById('kanban-search').addEventListener('input', (e) => {
  leadsFiltro.termo = e.target.value;
  renderKanban();
});

document.getElementById('kanban-filter-origem').addEventListener('change', (e) => {
  leadsFiltro.origem = e.target.value;
  renderKanban();
});

document.getElementById('kanban-filter-tag').addEventListener('change', (e) => {
  leadsTagFiltro = e.target.value;
  loadLeads();
});

/* ---------- TAGS ---------- */
async function loadTags() {
  try {
    tagsCache = await Api.tags.listar();
    popularFiltroTag();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function popularFiltroTag() {
  const select = document.getElementById('kanban-filter-tag');
  const atual = select.value;
  select.innerHTML = `<option value="">${Lang.t('dash.todasTags')}</option>` + tagsCache.map((t) => `<option value="${t.id}">${escapeHtml(t.nome)}</option>`).join('');
  const aindaExiste = tagsCache.some((t) => String(t.id) === atual);
  select.value = aindaExiste ? atual : '';
  if (!aindaExiste) leadsTagFiltro = '';
}

const tagModal = document.getElementById('tag-modal');

function abrirTagModal() {
  tagModal.classList.add('visible');
  renderTagManageList();
  document.getElementById('nt-nome').focus();
}

function fecharTagModal() {
  tagModal.classList.remove('visible');
  document.getElementById('new-tag-form').reset();
}

document.getElementById('open-tags').addEventListener('click', abrirTagModal);
tagModal.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', fecharTagModal));
tagModal.addEventListener('click', (e) => { if (e.target === tagModal) fecharTagModal(); });

function renderTagManageList() {
  const list = document.getElementById('tag-manage-list');
  if (tagsCache.length === 0) {
    list.innerHTML = `<div class="tag-manage-empty">${Lang.t('dash.nenhumaTagAinda')}</div>`;
    return;
  }

  list.innerHTML = tagsCache.map((t) => `
    <span class="tag-chip">
      ${escapeHtml(t.nome)}
      <button type="button" class="tag-chip-campanha" data-tag-id="${t.id}" data-tag-nome="${escapeHtml(t.nome)}" aria-label="Enviar mensagem pra leads com a tag ${escapeHtml(t.nome)}">${icon('send', 12)}</button>
      <button type="button" class="tag-chip-remove" data-tag-id="${t.id}" aria-label="Excluir tag ${escapeHtml(t.nome)}">${icon('x', 12)}</button>
    </span>
  `).join('');

  list.querySelectorAll('.tag-chip-remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tagId = btn.dataset.tagId;
      if (!confirm(Lang.t('dash.confirmExcluirTag'))) return;

      try {
        await Api.tags.remover(tagId);
        await loadTags();
        renderTagManageList();
        showToast(Lang.t('dash.tagExcluida'), 'success');
        loadLeads();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  list.querySelectorAll('.tag-chip-campanha').forEach((btn) => {
    btn.addEventListener('click', () => abrirCampanhaModal(btn.dataset.tagId, btn.dataset.tagNome));
  });
}

/* ---------- CAMPANHA (mensagem em massa por tag) ---------- */
const campanhaModal = document.getElementById('campanha-modal');
let campanhaTagId = null;

async function abrirCampanhaModal(tagId, tagNome) {
  campanhaTagId = tagId;
  document.getElementById('campanha-tag-nome').textContent = tagNome;
  document.getElementById('campanha-contagem').textContent = Lang.t('dash.carregando');
  document.getElementById('campanha-mensagem').value = '';
  campanhaModal.classList.add('visible');

  try {
    const { total, comTelefone } = await Api.tags.contagem(tagId);
    document.getElementById('campanha-contagem').textContent =
      total === 0
        ? Lang.t('dash.nenhumLeadComTag')
        : Lang.t('dash.leadsComTagTemTelefone', { comTelefone, total });
  } catch (err) {
    document.getElementById('campanha-contagem').textContent = Lang.t('dash.naoFoiPossivelCarregarContagem');
  }
}

function fecharCampanhaModal() {
  campanhaModal.classList.remove('visible');
  campanhaTagId = null;
}

campanhaModal.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', fecharCampanhaModal));
campanhaModal.addEventListener('click', (e) => { if (e.target === campanhaModal) fecharCampanhaModal(); });

document.getElementById('form-campanha').addEventListener('submit', async (e) => {
  e.preventDefault();

  const mensagem = document.getElementById('campanha-mensagem').value.trim();
  if (!mensagem) return;
  if (!confirm(Lang.t('dash.confirmEnviarCampanha'))) return;

  const btn = document.getElementById('campanha-submit');
  const label = document.getElementById('campanha-submit-label');
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span>';

  try {
    const { comTelefone } = await Api.tags.disparar(campanhaTagId, mensagem);
    showToast(Lang.t('dash.campanhaIniciada', { comTelefone }), 'success');
    fecharCampanhaModal();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = Lang.t('dash.enviarMensagem');
  }
});

document.getElementById('new-tag-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('nt-nome');
  const nome = input.value.trim();
  if (!nome) return;

  try {
    await Api.tags.criar(nome);
    input.value = '';
    await loadTags();
    renderTagManageList();
    showToast(Lang.t('dash.tagCriada'), 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

/* ---------- CAMPOS PERSONALIZADOS ---------- */
async function loadCampos() {
  try {
    camposCache = await Api.camposPersonalizados.listar();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

const camposModal = document.getElementById('campos-modal');
let campoEditandoId = null;

function abrirCamposModal() {
  camposModal.classList.add('visible');
  renderCamposManageList();
  document.getElementById('nc-nome').focus();
}

function sairDoModoEdicaoCampo() {
  campoEditandoId = null;
  document.getElementById('new-campo-form').reset();
  document.getElementById('nc-opcoes').classList.add('hidden');
  document.getElementById('nc-tipo').disabled = false;
  document.getElementById('nc-submit').textContent = Lang.t('dash.adicionar');
}

function fecharCamposModal() {
  camposModal.classList.remove('visible');
  sairDoModoEdicaoCampo();
}

function abrirEdicaoCampo(campo) {
  campoEditandoId = campo.id;
  document.getElementById('nc-nome').value = campo.nome;
  document.getElementById('nc-tipo').value = campo.tipo;
  document.getElementById('nc-tipo').disabled = true;
  const opcoesInput = document.getElementById('nc-opcoes');
  if (campo.tipo === 'selecao') {
    opcoesInput.value = (campo.opcoes || []).join(', ');
    opcoesInput.classList.remove('hidden');
  } else {
    opcoesInput.classList.add('hidden');
  }
  document.getElementById('nc-submit').textContent = Lang.t('dash.salvarAlteracoes');
  document.getElementById('nc-nome').focus();
}

document.getElementById('open-campos').addEventListener('click', abrirCamposModal);
camposModal.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', fecharCamposModal));
camposModal.addEventListener('click', (e) => { if (e.target === camposModal) fecharCamposModal(); });

document.getElementById('nc-tipo').addEventListener('change', (e) => {
  document.getElementById('nc-opcoes').classList.toggle('hidden', e.target.value !== 'selecao');
});

function renderCamposManageList() {
  const list = document.getElementById('campos-manage-list');
  if (camposCache.length === 0) {
    list.innerHTML = `<div class="tag-manage-empty">${Lang.t('dash.nenhumCampoAinda')}</div>`;
    return;
  }

  list.innerHTML = camposCache.map((c) => `
    <div class="campo-manage-row" data-campo-id="${c.id}">
      <span>${escapeHtml(c.nome)} <span class="badge badge-ativa">${tipoCampoLabel(c.tipo)}</span></span>
      <span>
        <button type="button" class="btn btn-ghost btn-sm campo-manage-editar" data-campo-id="${c.id}" aria-label="Editar campo ${escapeHtml(c.nome)}">${Lang.t('dash.editar')}</button>
        <button type="button" class="btn btn-ghost btn-sm campo-manage-remove" data-campo-id="${c.id}" aria-label="Excluir campo ${escapeHtml(c.nome)}">${icon('x', 14)}</button>
      </span>
    </div>
  `).join('');

  list.querySelectorAll('.campo-manage-editar').forEach((btn) => {
    btn.addEventListener('click', () => {
      const campo = camposCache.find((c) => String(c.id) === btn.dataset.campoId);
      if (campo) abrirEdicaoCampo(campo);
    });
  });

  list.querySelectorAll('.campo-manage-remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const campoId = btn.dataset.campoId;
      if (!confirm(Lang.t('dash.confirmExcluirCampo'))) return;

      try {
        await Api.camposPersonalizados.remover(campoId);
        if (String(campoEditandoId) === campoId) sairDoModoEdicaoCampo();
        await loadCampos();
        renderCamposManageList();
        showToast(Lang.t('dash.campoExcluido'), 'success');
        if (currentLeadId) await carregarCamposDoLead(currentLeadId);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

document.getElementById('new-campo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = document.getElementById('nc-nome').value.trim();
  const tipo = document.getElementById('nc-tipo').value;
  if (!nome) return;

  let opcoes;
  if (tipo === 'selecao') {
    opcoes = document.getElementById('nc-opcoes').value.split(',').map((s) => s.trim()).filter(Boolean);
    if (opcoes.length === 0) {
      showToast(Lang.t('dash.informeOpcao'), 'error');
      return;
    }
  }

  try {
    if (campoEditandoId) {
      const dados = { nome };
      if (opcoes) dados.opcoes = opcoes;
      await Api.camposPersonalizados.atualizar(campoEditandoId, dados);
      showToast(Lang.t('dash.campoAtualizado'), 'success');
    } else {
      const dados = { nome, tipo };
      if (opcoes) dados.opcoes = opcoes;
      await Api.camposPersonalizados.criar(dados);
      showToast(Lang.t('dash.campoCriado'), 'success');
    }

    sairDoModoEdicaoCampo();
    await loadCampos();
    renderCamposManageList();
    if (currentLeadId) await carregarCamposDoLead(currentLeadId);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

/* ---------- GRÁFICO (SPARKLINE) ---------- */
function renderSparkline() {
  const dias = 14;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const contagem = new Array(dias).fill(0);

  leadsCache.forEach((lead) => {
    const d = new Date(lead.criado_em);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((hoje - d) / 86400000);
    if (diff >= 0 && diff < dias) contagem[dias - 1 - diff]++;
  });

  const max = Math.max(1, ...contagem);
  const w = 560, h = 120, pad = 6;
  const stepX = w / (dias - 1);
  const pontos = contagem.map((v, i) => [i * stepX, h - pad - (v / max) * (h - pad * 2)]);

  const linePath = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;

  document.getElementById('sparkline').innerHTML = `
    <defs>
      <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0055FE" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#0055FE" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#sparkFill)" stroke="none"></path>
    <path d="${linePath}" fill="none" stroke="#4D8DFF" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></path>
  `;

  const total = contagem.reduce((a, b) => a + b, 0);
  document.getElementById('chart-sub').textContent = Lang.t('dash.leadsNovosUltimosDias', { total, dias });
  document.getElementById('sparkline-labels').innerHTML = `<span>${Lang.t('dash.diasAtras', { n: dias - 1 })}</span><span>${Lang.t('dash.hoje')}</span>`;

  atualizarBadgeLeadsHoje(contagem[dias - 1], contagem[dias - 2]);
}

function atualizarBadgeLeadsHoje(contagemHoje, contagemOntem) {
  const badge = document.getElementById('badge-leads-hoje');
  if (contagemOntem === 0) {
    badge.classList.add('hidden');
    return;
  }
  const variacao = Math.round(((contagemHoje - contagemOntem) / contagemOntem) * 100);
  badge.textContent = `${variacao >= 0 ? '↑' : '↓'} ${Math.abs(variacao)}%`;
  badge.className = `stat-badge ${variacao >= 0 ? 'up' : 'down'}`;
}

function renderKanban() {
  const colunas = {
    novo: document.querySelector('[data-col="novo"]'),
    em_contato: document.querySelector('[data-col="em_contato"]'),
    proposta_enviada: document.querySelector('[data-col="proposta_enviada"]'),
    fechado: document.querySelector('[data-col="fechado"]'),
  };

  Object.values(colunas).forEach((col) => { col.innerHTML = ''; });

  const contagem = { novo: 0, em_contato: 0, proposta_enviada: 0, fechado: 0 };

  leadsFiltrados().forEach((lead) => {
    const col = colunas[lead.status];
    if (!col) return;
    contagem[lead.status]++;
    col.appendChild(criarLeadCard(lead));
  });

  Object.entries(contagem).forEach(([status, total]) => {
    document.querySelector(`[data-count="${status}"]`).textContent = total;
  });

  Object.entries(colunas).forEach(([status, col]) => {
    if (contagem[status] === 0) {
      const vazio = document.createElement('div');
      vazio.className = 'kanban-empty';
      vazio.textContent = Lang.t('dash.semLeadsAqui');
      col.appendChild(vazio);
    }
  });
}

const CORES_STATUS_KANBAN = {
  novo: 'var(--azul-claro)',
  em_contato: 'var(--ciano)',
  proposta_enviada: 'var(--amber)',
  fechado: 'var(--verde)',
};

function iniciaisNome(nome) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function criarLeadCard(lead) {
  const card = document.createElement('div');
  card.className = 'lead-card anim-entrada';
  card.draggable = true;
  card.dataset.id = lead.id;
  card.style.borderLeftColor = CORES_STATUS_KANBAN[lead.status] || 'var(--azul-claro)';

  const valor = formatMoeda(lead.valor);
  const meta = [lead.servico, lead.origem].filter(Boolean).join(' • ') || Lang.t('dash.semDetalhes');

  card.innerHTML = `
    <div class="lead-card-top">
      <div class="lead-card-avatar">${escapeHtml(iniciaisNome(lead.nome))}</div>
      <div class="lead-card-name">${escapeHtml(lead.nome)}</div>
    </div>
    <div class="lead-card-meta">${escapeHtml(meta)}</div>
    <div class="lead-card-foot">
      ${lead.origem ? `<span class="k-tag">${escapeHtml(lead.origem)}</span>` : '<span></span>'}
      ${valor ? `<span class="lead-card-valor">${valor}</span>` : ''}
    </div>
  `;

  card.addEventListener('click', () => abrirPainel(lead.id));
  card.addEventListener('dragstart', () => {
    card.classList.add('dragging');
    dragLeadId = lead.id;
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  return card;
}

let dragLeadId = null;

document.querySelectorAll('.kanban-col').forEach((col) => {
  col.addEventListener('dragover', (e) => {
    e.preventDefault();
    col.classList.add('drag-over');
  });
  col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
  col.addEventListener('drop', async (e) => {
    e.preventDefault();
    col.classList.remove('drag-over');
    const novoStatus = col.dataset.status;
    if (dragLeadId == null) return;
    await moverLead(dragLeadId, novoStatus);
    dragLeadId = null;
  });
});

async function moverLead(leadId, novoStatus) {
  const lead = leadsCache.find((l) => l.id === leadId);
  if (!lead || lead.status === novoStatus) return;

  const statusAnterior = lead.status;
  lead.status = novoStatus;
  renderKanban();

  try {
    await Api.leads.atualizar(leadId, { status: novoStatus });
    addActivity(leadId, { tipo: 'status', de: statusAnterior, para: novoStatus });
    showToast(Lang.t('dash.movidoPara', { nome: lead.nome, status: statusLabel(novoStatus) }), 'success');
    loadDashboard();
  } catch (err) {
    lead.status = statusAnterior;
    renderKanban();
    showToast(err.message, 'error');
  }
}

/* ---------- ATIVIDADE (histórico de status, local ao navegador) ---------- */
function activityKey(leadId) {
  return `zync_activity_${leadId}`;
}

function getActivity(leadId) {
  try {
    return JSON.parse(localStorage.getItem(activityKey(leadId)) || '[]');
  } catch {
    return [];
  }
}

function addActivity(leadId, entry) {
  const lista = getActivity(leadId);
  lista.push({ ...entry, ts: new Date().toISOString() });
  localStorage.setItem(activityKey(leadId), JSON.stringify(lista));
}

document.getElementById('refresh-leads').addEventListener('click', () => {
  loadLeads();
  loadDashboard();
});

document.getElementById('export-csv').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    await downloadComAuth('/leads/export', 'leads.csv');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

/* ---------- IMPORTAR CSV ---------- */
document.getElementById('import-csv').addEventListener('click', () => {
  document.getElementById('import-csv-input').click();
});

document.getElementById('import-csv-input').addEventListener('change', async (e) => {
  const arquivo = e.target.files[0];
  e.target.value = '';
  if (!arquivo) return;

  const btn = document.getElementById('import-csv');
  btn.disabled = true;

  try {
    const texto = await arquivo.text();
    const resultado = await Api.leads.importar(texto);

    if (resultado.erros.length === 0) {
      showToast(Lang.t('dash.importacaoSucesso', { n: resultado.importados }), 'success');
    } else {
      const primeiroErro = resultado.erros[0];
      showToast(
        Lang.t('dash.importacaoParcial', { importados: resultado.importados, erros: resultado.erros.length, linha: primeiroErro.linha, motivo: primeiroErro.motivo }),
        resultado.importados > 0 ? 'success' : 'error'
      );
    }

    if (resultado.importados > 0) loadLeads();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

/* ---------- NOVO LEAD ---------- */
const leadModal = document.getElementById('lead-modal');

function abrirModal() {
  leadModal.classList.add('visible');
  document.getElementById('nl-nome').focus();
}

function fecharModal() {
  leadModal.classList.remove('visible');
  document.getElementById('new-lead-form').reset();
}

document.getElementById('open-new-lead').addEventListener('click', abrirModal);
leadModal.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', fecharModal));
leadModal.addEventListener('click', (e) => { if (e.target === leadModal) fecharModal(); });

document.getElementById('new-lead-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = document.getElementById('nl-nome').value.trim();
  if (!nome) return;

  const dados = {
    nome,
    servico: document.getElementById('nl-servico').value.trim() || null,
    origem: document.getElementById('nl-origem').value.trim() || null,
    telefone: document.getElementById('nl-telefone').value.trim() || null,
    valor: document.getElementById('nl-valor').value || null,
    status: document.getElementById('nl-status').value,
  };

  const btn = document.getElementById('nl-submit');
  const label = document.getElementById('nl-submit-label');
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span>';

  try {
    await Api.leads.criar(dados);
    showToast(Lang.t('dash.leadCriadoSucesso'), 'success');
    fecharModal();
    loadLeads();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = Lang.t('dash.criarLead');
  }
});

/* ---------- PAINEL DE CONVERSA ---------- */
const panel = document.getElementById('lead-panel');
const panelOverlay = document.getElementById('panel-overlay');

async function abrirPainel(leadId) {
  currentLeadId = leadId;
  const lead = leadsCache.find((l) => l.id === leadId);
  if (!lead) return;

  document.getElementById('panel-nome').textContent = lead.nome;
  document.getElementById('panel-meta').textContent = [lead.servico, lead.origem, lead.telefone].filter(Boolean).join(' • ') || Lang.t('dash.semDetalhesAdicionais');
  document.getElementById('panel-status').value = lead.status;

  panel.classList.add('visible');
  panelOverlay.classList.add('visible');

  setModo('humano');
  document.getElementById('panel-agenda-form').classList.add('hidden');
  await Promise.all([
    carregarMensagens(leadId),
    carregarTagsDoLead(leadId),
    carregarAgendamentosDoLead(leadId),
    carregarCamposDoLead(leadId),
  ]);
}

function fecharPainel() {
  panel.classList.remove('visible');
  panelOverlay.classList.remove('visible');
  currentLeadId = null;
}

document.getElementById('panel-close').addEventListener('click', fecharPainel);
panelOverlay.addEventListener('click', fecharPainel);

/* ---------- AGENDAMENTOS DO LEAD ---------- */
async function carregarAgendamentosDoLead(leadId) {
  const lista = document.getElementById('panel-agenda-list');
  lista.innerHTML = `<div class="panel-agenda-empty">${Lang.t('dash.carregando')}</div>`;

  try {
    const agendamentos = await Api.agendamentos.doLead(leadId);
    lista.innerHTML = '';

    if (agendamentos.length === 0) {
      lista.innerHTML = `<div class="panel-agenda-empty">${Lang.t('dash.nenhumAgendamentoAinda')}</div>`;
      return;
    }

    agendamentos.forEach((ag) => lista.appendChild(criarItemAgendamento(leadId, ag)));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function criarItemAgendamento(leadId, ag) {
  const item = document.createElement('div');
  item.className = 'panel-agenda-item';
  item.innerHTML = `
    <div class="panel-agenda-item-info">
      <div class="panel-agenda-item-data">${formatHora(ag.data_hora)}</div>
      ${ag.servico ? `<div class="panel-agenda-item-servico">${escapeHtml(ag.servico)}</div>` : ''}
    </div>
  `;

  const select = document.createElement('select');
  Object.keys(STATUS_AGENDAMENTO_LABEL_KEYS).forEach((valor) => {
    const option = document.createElement('option');
    option.value = valor;
    option.textContent = statusAgendamentoLabel(valor);
    if (valor === ag.status) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener('change', async () => {
    try {
      await Api.agendamentos.atualizar(ag.id, { status: select.value });
      showToast(Lang.t('dash.agendamentoAtualizado'), 'success');
    } catch (err) {
      showToast(err.message, 'error');
      select.value = ag.status;
    }
  });

  item.appendChild(select);
  return item;
}

const panelAgendaForm = document.getElementById('panel-agenda-form');

document.getElementById('panel-agenda-toggle').addEventListener('click', () => {
  panelAgendaForm.classList.toggle('hidden');
});

document.getElementById('panel-agenda-cancel').addEventListener('click', () => {
  panelAgendaForm.classList.add('hidden');
  panelAgendaForm.reset();
});

panelAgendaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentLeadId) return;

  const dataHoraInput = document.getElementById('ag-data-hora').value;
  if (!dataHoraInput) return;

  const dados = {
    data_hora: dataHoraInput.replace('T', ' ') + ':00',
    servico: document.getElementById('ag-servico').value.trim() || null,
  };

  try {
    await Api.agendamentos.criar(currentLeadId, dados);
    showToast(Lang.t('dash.agendamentoCriado'), 'success');
    panelAgendaForm.classList.add('hidden');
    panelAgendaForm.reset();
    await carregarAgendamentosDoLead(currentLeadId);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function carregarMensagens(leadId) {
  const body = document.getElementById('panel-messages');
  body.innerHTML = '<div class="empty-state" style="padding:2rem 1rem;"><span class="spinner"></span></div>';

  try {
    const mensagens = await Api.mensagens.listar(leadId);
    renderTimeline(leadId, mensagens);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderTimeline(leadId, mensagens) {
  const atividades = getActivity(leadId);
  const itens = [
    ...mensagens.map((m) => ({ tipo: 'mensagem', ts: m.criado_em, dados: m })),
    ...atividades.map((a) => ({ tipo: 'status', ts: a.ts, dados: a })),
  ].sort((a, b) => new Date(a.ts) - new Date(b.ts));

  const body = document.getElementById('panel-messages');
  body.innerHTML = '';

  if (itens.length === 0) {
    body.innerHTML = `<div class="empty-state" style="padding:2rem 1rem;"><div class="empty-state-icon">${icon('messageCircle', 36)}</div><div>${Lang.t('dash.nenhumaAtividadeAinda')}</div></div>`;
    return;
  }

  itens.forEach((item) => {
    body.appendChild(item.tipo === 'mensagem' ? criarBolhaMensagem(item.dados) : criarEntradaAtividade(item.dados));
  });
  body.scrollTop = body.scrollHeight;
}

function criarEntradaAtividade(a) {
  const div = document.createElement('div');
  div.className = 'timeline-status';
  div.innerHTML = `<span>${statusLabel(a.de)} → <strong>${statusLabel(a.para)}</strong> · ${formatHora(a.ts)}</span>`;
  return div;
}

function criarBolhaMensagem(m) {
  const div = document.createElement('div');
  div.className = `msg ${m.enviado_por}`;

  const corpo = m.tipo && m.tipo !== 'texto'
    ? `<div class="msg-midia" data-midia-id="${m.id}" data-midia-tipo="${m.tipo}"><span class="spinner"></span></div>${m.conteudo ? `<div>${escapeHtml(m.conteudo)}</div>` : ''}`
    : `<div>${escapeHtml(m.conteudo)}</div>`;

  div.innerHTML = `
    <div class="msg-sender-tag">${senderLabel(m.enviado_por)}</div>
    ${corpo}
    <div class="msg-meta">${formatHora(m.criado_em)}</div>
  `;

  if (m.tipo && m.tipo !== 'texto') {
    carregarMidiaMensagem(div.querySelector('.msg-midia'), m);
  }

  return div;
}

async function carregarMidiaMensagem(container, m) {
  try {
    const blobUrl = await Api.whatsapp.buscarMidiaBlob(currentLeadId, m.id);

    if (m.tipo === 'imagem') {
      container.innerHTML = `<img src="${blobUrl}" alt="Imagem enviada" class="msg-midia-img">`;
      container.querySelector('img').addEventListener('click', () => window.open(blobUrl, '_blank'));
    } else {
      container.innerHTML = `<a href="${blobUrl}" target="_blank" rel="noopener" class="msg-midia-doc">${icon('clipboardList', 16)} ${Lang.t('dash.verDocumento')}</a>`;
    }
  } catch {
    container.innerHTML = `<span style="color:var(--cinza); font-size:0.8rem;">${Lang.t('dash.naoFoiPossivelCarregarMidia')}</span>`;
  }
}

document.getElementById('panel-status').addEventListener('change', async (e) => {
  const novoStatus = e.target.value;
  if (!currentLeadId) return;

  const lead = leadsCache.find((l) => l.id === currentLeadId);
  const statusAnterior = lead ? lead.status : null;
  if (statusAnterior === novoStatus) return;

  try {
    await Api.leads.atualizar(currentLeadId, { status: novoStatus });
    if (lead) lead.status = novoStatus;
    if (statusAnterior) {
      addActivity(currentLeadId, { tipo: 'status', de: statusAnterior, para: novoStatus });
      await carregarMensagens(currentLeadId);
    }
    renderKanban();
    loadDashboard();
    showToast(Lang.t('dash.statusAtualizado'), 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function carregarTagsDoLead(leadId) {
  try {
    panelTagsCache = await Api.tags.doLead(leadId);
    renderPanelTags();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderPanelTags() {
  const lista = document.getElementById('panel-tags');
  lista.innerHTML = panelTagsCache.map((t) => `
    <span class="tag-chip">${escapeHtml(t.nome)} <button type="button" class="tag-chip-remove" data-tag-id="${t.id}" aria-label="Remover tag ${escapeHtml(t.nome)}">${icon('x', 12)}</button></span>
  `).join('');

  lista.querySelectorAll('.tag-chip-remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await Api.tags.desassociar(currentLeadId, btn.dataset.tagId);
        await carregarTagsDoLead(currentLeadId);
        showToast(Lang.t('dash.tagRemovidaDoLead'), 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  const select = document.getElementById('panel-tag-add');
  const disponiveis = tagsCache.filter((t) => !panelTagsCache.some((pt) => pt.id === t.id));
  select.innerHTML = `<option value="">${Lang.t('dash.maisTag')}</option>` + disponiveis.map((t) => `<option value="${t.id}">${escapeHtml(t.nome)}</option>`).join('');
}

document.getElementById('panel-tag-add').addEventListener('change', async (e) => {
  const tagId = e.target.value;
  if (!tagId || !currentLeadId) return;

  try {
    await Api.tags.associar(currentLeadId, tagId);
    await carregarTagsDoLead(currentLeadId);
    showToast(Lang.t('dash.tagAdicionada'), 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function carregarCamposDoLead(leadId) {
  try {
    panelCamposCache = await Api.camposPersonalizados.doLead(leadId);
    renderPanelCampos();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function inputDoCampo(campo) {
  const valor = campo.valor ?? '';
  if (campo.tipo === 'numero') return `<input type="number" class="campo-input" data-campo-id="${campo.id}" value="${escapeHtml(valor)}">`;
  if (campo.tipo === 'data') return `<input type="date" class="campo-input" data-campo-id="${campo.id}" value="${escapeHtml(valor)}">`;
  if (campo.tipo === 'selecao') {
    const opcoesHtml = (campo.opcoes || []).map((o) => `<option value="${escapeHtml(o)}" ${o === valor ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
    return `<select class="campo-input" data-campo-id="${campo.id}"><option value="">—</option>${opcoesHtml}</select>`;
  }
  return `<input type="text" class="campo-input" data-campo-id="${campo.id}" value="${escapeHtml(valor)}">`;
}

function renderPanelCampos() {
  const container = document.getElementById('panel-campos');

  if (panelCamposCache.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = panelCamposCache.map((c) => `
    <div class="campo-row">
      <label>${escapeHtml(c.nome)}</label>
      ${inputDoCampo(c)}
    </div>
  `).join('');

  async function salvar(input) {
    const campoId = input.dataset.campoId;
    try {
      await Api.camposPersonalizados.definir(currentLeadId, campoId, input.value.trim());
      const campo = panelCamposCache.find((c) => String(c.id) === campoId);
      if (campo) campo.valor = input.value.trim() || null;
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  container.querySelectorAll('input.campo-input').forEach((input) => {
    input.addEventListener('blur', () => salvar(input));
  });
  container.querySelectorAll('select.campo-input').forEach((select) => {
    select.addEventListener('change', () => salvar(select));
  });
}

document.getElementById('panel-delete').addEventListener('click', async () => {
  if (!currentLeadId) return;
  if (!confirm(Lang.t('dash.confirmExcluirLead'))) return;

  try {
    await Api.leads.remover(currentLeadId);
    showToast(Lang.t('dash.leadExcluido'), 'success');
    fecharPainel();
    loadLeads();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

/* ---------- ENVIO DE MENSAGEM ---------- */
const modeHumanoBtn = document.getElementById('mode-humano');
const modeIaBtn = document.getElementById('mode-ia');
const panelInput = document.getElementById('panel-input');

function setModo(modo) {
  panelMode = modo;
  if (modo === 'humano') {
    modeHumanoBtn.className = 'btn btn-secondary btn-sm';
    modeIaBtn.className = 'btn btn-ghost btn-sm';
    panelInput.placeholder = Lang.t('dash.placeholderHumano');
  } else {
    modeHumanoBtn.className = 'btn btn-ghost btn-sm';
    modeIaBtn.className = 'btn btn-secondary btn-sm';
    panelInput.placeholder = Lang.t('dash.placeholderIa');
  }
}

modeHumanoBtn.addEventListener('click', () => setModo('humano'));
modeIaBtn.addEventListener('click', () => setModo('ia'));

document.getElementById('panel-anexar').addEventListener('click', () => {
  document.getElementById('panel-arquivo').click();
});

document.getElementById('panel-arquivo').addEventListener('change', async (e) => {
  const arquivo = e.target.files[0];
  if (!arquivo || !currentLeadId) return;

  const anexarBtn = document.getElementById('panel-anexar');
  anexarBtn.disabled = true;

  try {
    const legenda = panelInput.value.trim() || undefined;
    const mensagem = await Api.whatsapp.enviarMidia(currentLeadId, arquivo, legenda);
    const body = document.getElementById('panel-messages');
    const vazio = body.querySelector('.empty-state');
    if (vazio) vazio.remove();
    body.appendChild(criarBolhaMensagem(mensagem));
    body.scrollTop = body.scrollHeight;
    panelInput.value = '';
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    anexarBtn.disabled = false;
    e.target.value = '';
  }
});

document.getElementById('panel-send').addEventListener('click', enviarMensagem);
panelInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    enviarMensagem();
  }
});

async function enviarMensagem() {
  const texto = panelInput.value.trim();
  if (!texto || !currentLeadId) return;

  const sendBtn = document.getElementById('panel-send');
  sendBtn.disabled = true;

  try {
    if (panelMode === 'humano') {
      const mensagem = await Api.whatsapp.enviar(currentLeadId, texto);
      document.getElementById('panel-messages').appendChild(criarBolhaMensagem(mensagem));
    } else {
      const { mensagemCliente, mensagemIA } = await Api.ia.simular(currentLeadId, texto);
      document.getElementById('panel-messages').appendChild(criarBolhaMensagem(mensagemCliente));
      document.getElementById('panel-messages').appendChild(criarBolhaMensagem(mensagemIA));
    }
    const body = document.getElementById('panel-messages');
    const vazio = body.querySelector('.empty-state');
    if (vazio) vazio.remove();
    body.scrollTop = body.scrollHeight;
    panelInput.value = '';
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    sendBtn.disabled = false;
  }
}

/* ---------- COMMAND PALETTE (Ctrl+K) ---------- */
function getCmdkAcoes() {
  const acao = Lang.t('dash.cmdkAcao');
  return [
    { icon: icon('dashboard', 16), label: Lang.t('dash.cmdkIrVisaoGeral'), hint: acao, run: () => document.getElementById('stats').scrollIntoView({ behavior: 'smooth' }) },
    { icon: icon('users', 16), label: Lang.t('dash.cmdkIrLeads'), hint: acao, run: () => document.getElementById('kanban').scrollIntoView({ behavior: 'smooth' }) },
    { icon: icon('plus', 16), label: Lang.t('dash.cmdkCriarLead'), hint: acao, run: () => abrirModal() },
    { icon: icon('tag', 16), label: Lang.t('dash.cmdkGerenciarTags'), hint: acao, run: () => abrirTagModal() },
    { icon: icon('clipboardList', 16), label: Lang.t('dash.cmdkGerenciarCampos'), hint: acao, run: () => abrirCamposModal() },
    { icon: icon('calendar', 16), label: Lang.t('dash.cmdkIrAgenda'), hint: acao, run: () => { window.location.href = 'agenda.html'; } },
    { icon: icon('settings', 16), label: Lang.t('dash.cmdkIrConfig'), hint: acao, run: () => { window.location.href = 'configuracoes.html'; } },
    { icon: icon('refreshCw', 16), label: Lang.t('dash.cmdkAtualizarDados'), hint: acao, run: () => { loadLeads(); loadDashboard(); } },
    { icon: icon('logOut', 16), label: Lang.t('dash.cmdkSairConta'), hint: acao, run: () => Auth.logout() },
  ];
}

function abrirCmdk() {
  document.getElementById('cmdk-overlay').classList.add('visible');
  const input = document.getElementById('cmdk-input');
  input.value = '';
  input.focus();
  renderCmdkResultados('');
}

function fecharCmdk() {
  document.getElementById('cmdk-overlay').classList.remove('visible');
}

function renderCmdkResultados(termo) {
  const t = termo.trim().toLowerCase();
  const acoes = getCmdkAcoes().filter((a) => a.label.toLowerCase().includes(t));
  const leadsResultado = t ? leadsCache.filter((l) => l.nome.toLowerCase().includes(t)).slice(0, 6) : [];

  cmdkItems = [
    ...acoes,
    ...leadsResultado.map((l) => ({ icon: icon('user', 16), label: l.nome, hint: statusLabel(l.status), run: () => abrirPainel(l.id) })),
  ];
  cmdkIndex = 0;

  const list = document.getElementById('cmdk-list');
  if (cmdkItems.length === 0) {
    list.innerHTML = `<div class="cmdk-empty">${Lang.t('dash.cmdkNadaEncontrado')}</div>`;
    return;
  }

  list.innerHTML = cmdkItems.map((item, i) => `
    <div class="cmdk-item ${i === 0 ? 'active' : ''}" data-index="${i}">
      <span class="cmdk-item-icon">${item.icon}</span>
      <span class="cmdk-item-label">${escapeHtml(item.label)}</span>
      <span class="cmdk-item-hint">${item.hint}</span>
    </div>
  `).join('');

  list.querySelectorAll('.cmdk-item').forEach((el) => {
    el.addEventListener('click', () => executarCmdkItem(Number(el.dataset.index)));
  });
}

function executarCmdkItem(index) {
  const item = cmdkItems[index];
  if (!item) return;
  fecharCmdk();
  item.run();
}

function moverSelecaoCmdk(delta) {
  if (cmdkItems.length === 0) return;
  cmdkIndex = (cmdkIndex + delta + cmdkItems.length) % cmdkItems.length;
  document.querySelectorAll('.cmdk-item').forEach((el, i) => el.classList.toggle('active', i === cmdkIndex));
  const ativo = document.querySelector('.cmdk-item.active');
  if (ativo) ativo.scrollIntoView({ block: 'nearest' });
}

document.getElementById('open-cmdk').addEventListener('click', abrirCmdk);
document.getElementById('cmdk-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'cmdk-overlay') fecharCmdk();
});
document.getElementById('cmdk-input').addEventListener('input', (e) => renderCmdkResultados(e.target.value));

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    abrirCmdk();
    return;
  }

  const overlay = document.getElementById('cmdk-overlay');
  if (!overlay.classList.contains('visible')) return;

  if (e.key === 'Escape') {
    fecharCmdk();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    moverSelecaoCmdk(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    moverSelecaoCmdk(-1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    executarCmdkItem(cmdkIndex);
  }
});

/* ---------- NAV ATIVA ---------- */
document.querySelectorAll('.sidebar-item[data-nav]').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-item[data-nav]').forEach((i) => i.classList.remove('active'));
    item.classList.add('active');
  });
});

/* ---------- ANÁLISES ---------- */
const STATUS_FUNIL_ORDEM = ['novo', 'em_contato', 'proposta_enviada', 'fechado'];
let faturamentoPontos = [];

async function carregarAnalises() {
  try {
    const [origem, funil] = await Promise.all([
      Api.relatorios.leadsPorOrigem(),
      Api.relatorios.funilConversao(),
    ]);
    renderOrigem(origem);
    renderFunil(funil);
    await carregarFaturamento();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function carregarFaturamento() {
  const dias = Number(document.getElementById('faturamento-periodo').value);
  try {
    const dados = await Api.relatorios.faturamento({ agrupamento: 'dia' });
    renderFaturamento(dados, dias);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('faturamento-periodo').addEventListener('change', () => {
  document.getElementById('faturamento-sub').textContent = Lang.t('dash.ultimosDiasTemplate', { n: document.getElementById('faturamento-periodo').value });
  carregarFaturamento();
});

function renderOrigem(dados) {
  const container = document.getElementById('chart-origem');

  if (dados.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:1.5rem;">${Lang.t('dash.semLeadsAindaChart')}</div>`;
    return;
  }

  const max = Math.max(...dados.map((d) => d.total));
  container.innerHTML = dados.map((d) => `
    <div class="barlist-row">
      <div class="barlist-top"><span>${escapeHtml(d.origem)}</span><strong>${d.total}</strong></div>
      <div class="barlist-track"><div class="barlist-fill" style="width:${(d.total / max) * 100}%"></div></div>
    </div>
  `).join('');
}

function renderFunil(dados) {
  const container = document.getElementById('chart-funil');
  const { porStatus, totalGeral, taxaConversao } = dados;

  if (!totalGeral) {
    container.innerHTML = `<div class="empty-state" style="padding:1.5rem;">${Lang.t('dash.semLeadsAindaChart')}</div>`;
    document.getElementById('funil-gauge').style.setProperty('--value', 0);
    document.getElementById('funil-gauge-num').textContent = '—';
    return;
  }

  container.innerHTML = STATUS_FUNIL_ORDEM.map((status) => {
    const total = porStatus[status] || 0;
    return `
      <div class="barlist-row">
        <div class="barlist-top"><span>${statusLabel(status)}</span><strong>${total}</strong></div>
        <div class="barlist-track"><div class="barlist-fill" style="width:${(total / totalGeral) * 100}%"></div></div>
      </div>
    `;
  }).join('');

  document.getElementById('funil-gauge').style.setProperty('--value', taxaConversao);
  document.getElementById('funil-gauge-num').textContent = `${taxaConversao}%`;
}

function renderFaturamento(dados, dias) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const valores = new Array(dias).fill(0);
  const datas = new Array(dias).fill(null).map((_, i) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - (dias - 1 - i));
    return d;
  });

  dados.forEach((d) => {
    const data = new Date(d.periodo);
    data.setHours(0, 0, 0, 0);
    const diff = Math.round((hoje - data) / 86400000);
    if (diff >= 0 && diff < dias) valores[dias - 1 - diff] = Number(d.total);
  });

  const max = Math.max(1, ...valores);
  const w = 560, h = 160, pad = 8;
  const stepX = w / (dias - 1);
  const pontos = valores.map((v, i) => [i * stepX, h - pad - (v / max) * (h - pad * 2)]);
  faturamentoPontos = pontos.map((p, i) => ({ x: p[0], y: p[1], valor: valores[i], data: datas[i] }));

  const linePath = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;

  document.getElementById('faturamento-chart').innerHTML = `
    <defs>
      <linearGradient id="fatFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4D8DFF" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#0055FE" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="fatStroke" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#0055FE"/>
        <stop offset="100%" stop-color="#4D8DFF"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#fatFill)" stroke="none"></path>
    <path d="${linePath}" fill="none" stroke="url(#fatStroke)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"></path>
    <circle id="faturamento-marker" cx="0" cy="0" r="4" fill="#fff" stroke="#0055FE" stroke-width="2" class="hidden"></circle>
  `;

  const total = valores.reduce((a, b) => a + b, 0);
  document.getElementById('faturamento-total').textContent = formatMoeda(total) || 'R$0,00';
}

const faturamentoSvg = document.getElementById('faturamento-chart');
const faturamentoTooltip = document.getElementById('faturamento-tooltip');

faturamentoSvg.addEventListener('mousemove', (e) => {
  if (faturamentoPontos.length === 0) return;

  const rect = faturamentoSvg.getBoundingClientRect();
  const xRelativo = ((e.clientX - rect.left) / rect.width) * 560;
  let maisProximo = faturamentoPontos[0];
  for (const p of faturamentoPontos) {
    if (Math.abs(p.x - xRelativo) < Math.abs(maisProximo.x - xRelativo)) maisProximo = p;
  }

  const marker = document.getElementById('faturamento-marker');
  if (marker) {
    marker.setAttribute('cx', maisProximo.x);
    marker.setAttribute('cy', maisProximo.y);
    marker.classList.remove('hidden');
  }

  faturamentoTooltip.innerHTML = `
    <div class="chart-tooltip-valor">${formatMoeda(maisProximo.valor) || 'R$0,00'}</div>
    <div class="chart-tooltip-data">${maisProximo.data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
  `;
  faturamentoTooltip.style.left = `${(maisProximo.x / 560) * 100}%`;
  faturamentoTooltip.classList.remove('hidden');
});

faturamentoSvg.addEventListener('mouseleave', () => {
  faturamentoTooltip.classList.add('hidden');
  const marker = document.getElementById('faturamento-marker');
  if (marker) marker.classList.add('hidden');
});

/* ---------- NPS ---------- */
async function verificarNps() {
  try {
    const { elegivel } = await Api.nps.elegivel();
    if (!elegivel) return;

    const banner = document.getElementById('nps-banner');
    const escala = document.getElementById('nps-scale');
    let notaEscolhida = null;

    escala.innerHTML = Array.from({ length: 11 }, (_, n) => `<button type="button" class="nps-nota" data-nota="${n}">${n}</button>`).join('');
    banner.style.display = 'block';

    escala.querySelectorAll('.nps-nota').forEach((btn) => {
      btn.addEventListener('click', () => {
        notaEscolhida = Number(btn.dataset.nota);
        escala.querySelectorAll('.nps-nota').forEach((b) => b.classList.toggle('selecionada', b === btn));
        document.getElementById('nps-comentario-wrap').classList.remove('hidden');
      });
    });

    document.getElementById('nps-enviar').addEventListener('click', async () => {
      if (notaEscolhida === null) return;
      try {
        await Api.nps.enviar(notaEscolhida, document.getElementById('nps-comentario').value.trim() || undefined);
        showToast(Lang.t('dash.npsObrigado'), 'success');
        banner.style.display = 'none';
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  } catch {
    /* silencioso -- nao quebra o dashboard por causa do NPS */
  }
}

document.getElementById('nps-dismiss').addEventListener('click', async () => {
  document.getElementById('nps-banner').style.display = 'none';
  try { await Api.nps.dispensar(); } catch { /* ignora */ }
});

/* ---------- INIT ---------- */
loadDashboard();
loadLeads();
loadTags();
loadCampos();
carregarAnalises();
verificarNps();
