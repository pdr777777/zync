Auth.requireAuth();

const STATUS_LABELS = {
  novo: 'Novo lead',
  em_contato: 'Em contato',
  proposta_enviada: 'Proposta enviada',
  fechado: 'Fechado',
};

const SENDER_LABELS = {
  cliente: `${icon('user', 12)} Cliente`,
  humano: `${icon('user', 12)} Você`,
  ia: `${icon('bot', 12)} IA`,
};

let leadsCache = [];
let currentLeadId = null;
let panelMode = 'humano';
let leadsFiltro = { termo: '', origem: '' };
let tagsCache = [];
let leadsTagFiltro = '';
let panelTagsCache = [];
let camposCache = [];
let panelCamposCache = [];

const TIPO_CAMPO_LABELS = {
  texto: 'Texto',
  numero: 'Número',
  data: 'Data',
  selecao: 'Seleção',
};
let cmdkItems = [];
let cmdkIndex = 0;

const STATUS_AGENDAMENTO_LABELS = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  concluido: 'Concluído',
};

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
  } catch (err) {
    showToast(err.message, 'error');
  }
}

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
  select.innerHTML = '<option value="">Todas as origens</option>' + origens.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
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
  select.innerHTML = '<option value="">Todas as tags</option>' + tagsCache.map((t) => `<option value="${t.id}">${escapeHtml(t.nome)}</option>`).join('');
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
    list.innerHTML = '<div class="tag-manage-empty">Nenhuma tag ainda. Crie a primeira abaixo.</div>';
    return;
  }

  list.innerHTML = tagsCache.map((t) => `
    <span class="tag-chip">${escapeHtml(t.nome)} <button type="button" class="tag-chip-remove" data-tag-id="${t.id}" aria-label="Excluir tag ${escapeHtml(t.nome)}">${icon('x', 12)}</button></span>
  `).join('');

  list.querySelectorAll('.tag-chip-remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tagId = btn.dataset.tagId;
      if (!confirm('Excluir esta tag? Ela será removida de todos os leads.')) return;

      try {
        await Api.tags.remover(tagId);
        await loadTags();
        renderTagManageList();
        showToast('Tag excluída', 'success');
        loadLeads();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

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
    showToast('Tag criada', 'success');
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
  document.getElementById('nc-submit').textContent = 'Adicionar';
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
  document.getElementById('nc-submit').textContent = 'Salvar alterações';
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
    list.innerHTML = '<div class="tag-manage-empty">Nenhum campo ainda. Crie o primeiro abaixo.</div>';
    return;
  }

  list.innerHTML = camposCache.map((c) => `
    <div class="campo-manage-row" data-campo-id="${c.id}">
      <span>${escapeHtml(c.nome)} <span class="badge badge-ativa">${TIPO_CAMPO_LABELS[c.tipo] || c.tipo}</span></span>
      <span>
        <button type="button" class="btn btn-ghost btn-sm campo-manage-editar" data-campo-id="${c.id}" aria-label="Editar campo ${escapeHtml(c.nome)}">Editar</button>
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
      if (!confirm('Excluir este campo? Os valores dele em todos os leads serão perdidos.')) return;

      try {
        await Api.camposPersonalizados.remover(campoId);
        if (String(campoEditandoId) === campoId) sairDoModoEdicaoCampo();
        await loadCampos();
        renderCamposManageList();
        showToast('Campo excluído', 'success');
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
      showToast('Informe pelo menos uma opção separada por vírgula', 'error');
      return;
    }
  }

  try {
    if (campoEditandoId) {
      const dados = { nome };
      if (opcoes) dados.opcoes = opcoes;
      await Api.camposPersonalizados.atualizar(campoEditandoId, dados);
      showToast('Campo atualizado', 'success');
    } else {
      const dados = { nome, tipo };
      if (opcoes) dados.opcoes = opcoes;
      await Api.camposPersonalizados.criar(dados);
      showToast('Campo criado', 'success');
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
  document.getElementById('chart-sub').textContent = `${total} leads novos nos últimos ${dias} dias`;
  document.getElementById('sparkline-labels').innerHTML = `<span>${dias - 1} dias atrás</span><span>Hoje</span>`;

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
      vazio.textContent = 'Sem leads aqui';
      col.appendChild(vazio);
    }
  });
}

function criarLeadCard(lead) {
  const card = document.createElement('div');
  card.className = 'lead-card anim-entrada';
  card.draggable = true;
  card.dataset.id = lead.id;

  const valor = formatMoeda(lead.valor);
  const meta = [lead.servico, lead.origem].filter(Boolean).join(' • ') || 'Sem detalhes';

  card.innerHTML = `
    <div class="lead-card-name">${escapeHtml(lead.nome)}</div>
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
    showToast(`${lead.nome} movido para "${STATUS_LABELS[novoStatus]}"`, 'success');
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
    showToast('Lead criado com sucesso', 'success');
    fecharModal();
    loadLeads();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = 'Criar lead';
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
  document.getElementById('panel-meta').textContent = [lead.servico, lead.origem, lead.telefone].filter(Boolean).join(' • ') || 'Sem detalhes adicionais';
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
  lista.innerHTML = '<div class="panel-agenda-empty">Carregando…</div>';

  try {
    const agendamentos = await Api.agendamentos.doLead(leadId);
    lista.innerHTML = '';

    if (agendamentos.length === 0) {
      lista.innerHTML = '<div class="panel-agenda-empty">Nenhum agendamento ainda</div>';
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
  Object.entries(STATUS_AGENDAMENTO_LABELS).forEach(([valor, label]) => {
    const option = document.createElement('option');
    option.value = valor;
    option.textContent = label;
    if (valor === ag.status) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener('change', async () => {
    try {
      await Api.agendamentos.atualizar(ag.id, { status: select.value });
      showToast('Agendamento atualizado', 'success');
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
    showToast('Agendamento criado', 'success');
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
    body.innerHTML = `<div class="empty-state" style="padding:2rem 1rem;"><div class="empty-state-icon">${icon('messageCircle', 36)}</div><div>Nenhuma atividade ainda</div></div>`;
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
  div.innerHTML = `<span>${STATUS_LABELS[a.de] || a.de} → <strong>${STATUS_LABELS[a.para] || a.para}</strong> · ${formatHora(a.ts)}</span>`;
  return div;
}

function criarBolhaMensagem(m) {
  const div = document.createElement('div');
  div.className = `msg ${m.enviado_por}`;
  div.innerHTML = `
    <div class="msg-sender-tag">${SENDER_LABELS[m.enviado_por] || m.enviado_por}</div>
    <div>${escapeHtml(m.conteudo)}</div>
    <div class="msg-meta">${formatHora(m.criado_em)}</div>
  `;
  return div;
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
    showToast('Status atualizado', 'success');
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
        showToast('Tag removida do lead', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  const select = document.getElementById('panel-tag-add');
  const disponiveis = tagsCache.filter((t) => !panelTagsCache.some((pt) => pt.id === t.id));
  select.innerHTML = '<option value="">+ tag</option>' + disponiveis.map((t) => `<option value="${t.id}">${escapeHtml(t.nome)}</option>`).join('');
}

document.getElementById('panel-tag-add').addEventListener('change', async (e) => {
  const tagId = e.target.value;
  if (!tagId || !currentLeadId) return;

  try {
    await Api.tags.associar(currentLeadId, tagId);
    await carregarTagsDoLead(currentLeadId);
    showToast('Tag adicionada', 'success');
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
  if (!confirm('Tem certeza que deseja excluir este lead? Essa ação não pode ser desfeita.')) return;

  try {
    await Api.leads.remover(currentLeadId);
    showToast('Lead excluído', 'success');
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
    panelInput.placeholder = 'Responder como atendente (envia via WhatsApp)…';
  } else {
    modeHumanoBtn.className = 'btn btn-ghost btn-sm';
    modeIaBtn.className = 'btn btn-secondary btn-sm';
    panelInput.placeholder = 'Simule o que o cliente diria, e veja a IA responder…';
  }
}

modeHumanoBtn.addEventListener('click', () => setModo('humano'));
modeIaBtn.addEventListener('click', () => setModo('ia'));

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
  return [
    { icon: icon('dashboard', 16), label: 'Ir para Visão geral', hint: 'Ação', run: () => document.getElementById('stats').scrollIntoView({ behavior: 'smooth' }) },
    { icon: icon('users', 16), label: 'Ir para Leads (kanban)', hint: 'Ação', run: () => document.getElementById('kanban').scrollIntoView({ behavior: 'smooth' }) },
    { icon: icon('plus', 16), label: 'Criar novo lead', hint: 'Ação', run: () => abrirModal() },
    { icon: icon('tag', 16), label: 'Gerenciar tags', hint: 'Ação', run: () => abrirTagModal() },
    { icon: icon('clipboardList', 16), label: 'Gerenciar campos personalizados', hint: 'Ação', run: () => abrirCamposModal() },
    { icon: icon('calendar', 16), label: 'Ir para Agenda', hint: 'Ação', run: () => { window.location.href = 'agenda.html'; } },
    { icon: icon('user', 16), label: 'Ir para Perfil', hint: 'Ação', run: () => { window.location.href = 'perfil.html'; } },
    { icon: icon('refreshCw', 16), label: 'Atualizar dados', hint: 'Ação', run: () => { loadLeads(); loadDashboard(); } },
    { icon: icon('logOut', 16), label: 'Sair da conta', hint: 'Ação', run: () => Auth.logout() },
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
    ...leadsResultado.map((l) => ({ icon: icon('user', 16), label: l.nome, hint: STATUS_LABELS[l.status], run: () => abrirPainel(l.id) })),
  ];
  cmdkIndex = 0;

  const list = document.getElementById('cmdk-list');
  if (cmdkItems.length === 0) {
    list.innerHTML = '<div class="cmdk-empty">Nada encontrado</div>';
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
  document.getElementById('faturamento-sub').textContent = `últimos ${document.getElementById('faturamento-periodo').value} dias`;
  carregarFaturamento();
});

function renderOrigem(dados) {
  const container = document.getElementById('chart-origem');

  if (dados.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:1.5rem;">Sem leads ainda</div>';
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
    container.innerHTML = '<div class="empty-state" style="padding:1.5rem;">Sem leads ainda</div>';
    return;
  }

  container.innerHTML = STATUS_FUNIL_ORDEM.map((status) => {
    const total = porStatus[status] || 0;
    return `
      <div class="barlist-row">
        <div class="barlist-top"><span>${STATUS_LABELS[status]}</span><strong>${total}</strong></div>
        <div class="barlist-track"><div class="barlist-fill" style="width:${(total / totalGeral) * 100}%"></div></div>
      </div>
    `;
  }).join('') + `<div class="funil-resumo">${taxaConversao}% dos leads chegam a fechar</div>`;
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

/* ---------- INIT ---------- */
loadDashboard();
loadLeads();
loadTags();
loadCampos();
carregarAnalises();
