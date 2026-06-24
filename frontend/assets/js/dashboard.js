Auth.requireAuth();

const STATUS_LABELS = {
  novo: 'Novo lead',
  em_contato: 'Em contato',
  proposta_enviada: 'Proposta enviada',
  fechado: 'Fechado',
};

const SENDER_LABELS = {
  cliente: '👤 Cliente',
  humano: '🧑‍💼 Você',
  ia: '🤖 IA',
};

let leadsCache = [];
let currentLeadId = null;
let panelMode = 'humano';
let leadsFiltro = { termo: '', origem: '' };
let cmdkItems = [];
let cmdkIndex = 0;

function formatMoeda(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function iniciais(nome) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

/* ---------- USUÁRIO ---------- */
function renderUsuario() {
  const usuario = Auth.getUsuario();
  if (!usuario) return;
  document.getElementById('user-avatar').textContent = iniciais(usuario.nome);
  document.getElementById('user-name').textContent = usuario.nome;
  document.getElementById('user-email').textContent = usuario.email;
}

document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());

/* ---------- DASHBOARD STATS ---------- */
async function loadDashboard() {
  try {
    const data = await Api.dashboard();
    document.getElementById('stat-leads-hoje').textContent = data.leadsHoje;
    document.getElementById('stat-conversoes').textContent = data.conversoes;
    document.getElementById('stat-mensagens').textContent = data.mensagensEnviadas;
    document.getElementById('stat-ia').textContent = `${data.taxaRespostaIA}%`;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ---------- KANBAN ---------- */
async function loadLeads() {
  try {
    leadsCache = await Api.leads.listar();
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
  select.value = origens.includes(atual) ? atual : '';
}

document.getElementById('kanban-search').addEventListener('input', (e) => {
  leadsFiltro.termo = e.target.value;
  renderKanban();
});

document.getElementById('kanban-filter-origem').addEventListener('change', (e) => {
  leadsFiltro.origem = e.target.value;
  renderKanban();
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
        <stop offset="0%" stop-color="#7C3AED" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#7C3AED" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#sparkFill)" stroke="none"></path>
    <path d="${linePath}" fill="none" stroke="#A78BFA" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></path>
  `;

  const total = contagem.reduce((a, b) => a + b, 0);
  document.getElementById('chart-sub').textContent = `${total} leads novos nos últimos ${dias} dias`;
  document.getElementById('sparkline-labels').innerHTML = `<span>${dias - 1} dias atrás</span><span>Hoje</span>`;
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
  card.className = 'lead-card';
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
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
  await carregarMensagens(leadId);
}

function fecharPainel() {
  panel.classList.remove('visible');
  panelOverlay.classList.remove('visible');
  currentLeadId = null;
}

document.getElementById('panel-close').addEventListener('click', fecharPainel);
panelOverlay.addEventListener('click', fecharPainel);

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
    body.innerHTML = '<div class="empty-state" style="padding:2rem 1rem;"><div class="empty-state-icon">💬</div><div>Nenhuma atividade ainda</div></div>';
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
    { icon: '📊', label: 'Ir para Visão geral', hint: 'Ação', run: () => document.getElementById('stats').scrollIntoView({ behavior: 'smooth' }) },
    { icon: '👥', label: 'Ir para Leads (kanban)', hint: 'Ação', run: () => document.getElementById('kanban').scrollIntoView({ behavior: 'smooth' }) },
    { icon: '➕', label: 'Criar novo lead', hint: 'Ação', run: () => abrirModal() },
    { icon: '↻', label: 'Atualizar dados', hint: 'Ação', run: () => { loadLeads(); loadDashboard(); } },
    { icon: '⏻', label: 'Sair da conta', hint: 'Ação', run: () => Auth.logout() },
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
    ...leadsResultado.map((l) => ({ icon: '🧑', label: l.nome, hint: STATUS_LABELS[l.status], run: () => abrirPainel(l.id) })),
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

/* ---------- INIT ---------- */
renderUsuario();
loadDashboard();
loadLeads();
