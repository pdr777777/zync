Auth.requireAuth();

if (!Auth.isAdmin()) {
  window.location.href = 'dashboard.html';
}

function formatBRL(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function iniciaisNome(nome) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function formatDataRelativa(dataIso) {
  const diffDias = Math.floor((Date.now() - new Date(dataIso)) / 86400000);
  if (diffDias <= 0) return 'Hoje';
  if (diffDias === 1) return 'Ontem';
  if (diffDias < 30) return `Há ${diffDias} dias`;
  return new Date(dataIso).toLocaleDateString('pt-BR');
}

const STATUS_LABELS_EMPRESA = { ativa: 'Ativa', pendente: 'Pendente', cancelada: 'Cancelada', sem_assinatura: 'Sem assinatura' };

/* ---------- MÉTRICAS ---------- */
async function carregarMetricas() {
  try {
    const dados = await Api.admin.metricas();
    document.getElementById('adm-total-usuarios').textContent = dados.totalUsuarios;
    document.getElementById('adm-mrr').textContent = formatBRL(dados.mrr);
    document.getElementById('adm-ativas').textContent = dados.assinaturasPorStatus.ativa || 0;
    const pendentesCanceladas = (dados.assinaturasPorStatus.pendente || 0) + (dados.assinaturasPorStatus.cancelada || 0);
    document.getElementById('adm-pendentes').textContent = pendentesCanceladas;
    renderGaugeAtivas(dados);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ---------- GAUGE: ASSINATURAS ATIVAS ---------- */
function renderGaugeAtivas(dados) {
  const ativas = dados.assinaturasPorStatus.ativa || 0;
  const pendentes = dados.assinaturasPorStatus.pendente || 0;
  const canceladas = dados.assinaturasPorStatus.cancelada || 0;
  const total = dados.totalUsuarios || 0;
  const pct = total ? Math.round((ativas / total) * 100) : 0;

  document.getElementById('adm-gauge-ativas').style.setProperty('--value', pct);
  document.getElementById('adm-gauge-num').textContent = `${pct}%`;

  document.getElementById('adm-gauge-sub').innerHTML = `
    <div class="gauge-sub-row"><span class="gauge-sub-dot" style="background:var(--verde)"></span>Ativas <strong>${ativas}</strong></div>
    <div class="gauge-sub-row"><span class="gauge-sub-dot" style="background:var(--amber)"></span>Pendentes <strong>${pendentes}</strong></div>
    <div class="gauge-sub-row"><span class="gauge-sub-dot" style="background:var(--vermelho)"></span>Canceladas <strong>${canceladas}</strong></div>
  `;
}

/* ---------- ANÁLISES NA HOME (empresas, receita, tabela) ---------- */
function renderBarlistHome(container, entradas, formatarValor) {
  if (entradas.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:1.5rem;">Sem dados suficientes ainda.</div>';
    return;
  }

  const max = Math.max(...entradas.map(([, total]) => total));
  container.innerHTML = entradas.map(([rotulo, total]) => `
    <div class="barlist-row">
      <div class="barlist-top"><span>${escapeHtml(rotulo)}</span><strong>${formatarValor(total)}</strong></div>
      <div class="barlist-track"><div class="barlist-fill" style="width:${max ? (total / max) * 100 : 0}%"></div></div>
    </div>
  `).join('');
}

function renderReceitaPorPlanoHome(usuarios, planos) {
  const precoPorPlano = {};
  planos.forEach((p) => { precoPorPlano[p.nome] = Number(p.preco); });

  const receita = {};
  usuarios.forEach((u) => {
    if (u.assinatura_status !== 'ativa' || !u.plano_nome) return;
    receita[u.plano_nome] = (receita[u.plano_nome] || 0) + (precoPorPlano[u.plano_nome] || 0);
  });

  renderBarlistHome(document.getElementById('analise-receita-home'), Object.entries(receita), formatBRL);
}

function renderCadastrosChart(usuarios) {
  const meses = 6;
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const contagem = new Array(meses).fill(0);
  const labels = new Array(meses).fill(null).map((_, i) => {
    const d = new Date(inicioMes);
    d.setMonth(d.getMonth() - (meses - 1 - i));
    return d;
  });

  usuarios.forEach((u) => {
    const d = new Date(u.criado_em);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    const diffMeses = (inicioMes.getFullYear() - d.getFullYear()) * 12 + (inicioMes.getMonth() - d.getMonth());
    if (diffMeses >= 0 && diffMeses < meses) contagem[meses - 1 - diffMeses]++;
  });

  const max = Math.max(1, ...contagem);
  const w = 560, h = 150, pad = 8;
  const stepX = w / (meses - 1);
  const pontos = contagem.map((v, i) => [i * stepX, h - pad - (v / max) * (h - pad * 2)]);

  const linePath = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;

  document.getElementById('adm-cadastros-chart').innerHTML = `
    <defs>
      <linearGradient id="admFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4D8DFF" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#0055FE" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#admFill)" stroke="none"></path>
    <path d="${linePath}" fill="none" stroke="#4D8DFF" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></path>
  `;

  document.getElementById('adm-cadastros-labels').innerHTML =
    `<span>${labels[0].toLocaleDateString('pt-BR', { month: 'short' })}</span><span>${labels[labels.length - 1].toLocaleDateString('pt-BR', { month: 'short' })}</span>`;

  const novas30Dias = usuarios.filter((u) => (Date.now() - new Date(u.criado_em)) / 86400000 <= 30).length;
  document.getElementById('adm-novas-empresas').textContent = novas30Dias;
}

function renderTabelaEmpresas(usuarios) {
  const tbody = document.querySelector('#adm-tabela-empresas tbody');
  const top = usuarios.slice(0, 8);

  if (top.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state" style="padding:1.5rem;">Nenhuma empresa cadastrada ainda</div></td></tr>';
    return;
  }

  tbody.innerHTML = top.map((u) => {
    const status = u.assinatura_status || 'sem_assinatura';
    return `
      <tr>
        <td>
          <div class="table-cell-empresa">
            <div class="table-avatar">${escapeHtml(iniciaisNome(u.nome))}</div>
            <div>
              <div class="table-empresa-nome">${escapeHtml(u.nome)}</div>
              <div class="table-empresa-email">${escapeHtml(u.email)}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(u.plano_nome || '—')}</td>
        <td><span class="status-pill ${status}">${STATUS_LABELS_EMPRESA[status] || status}</span></td>
        <td>${formatDataRelativa(u.criado_em)}</td>
      </tr>
    `;
  }).join('');
}

async function carregarAnalisesHome() {
  try {
    const [usuarios, planos] = await Promise.all([Api.admin.usuarios(), Api.admin.planos.listar()]);
    renderCadastrosChart(usuarios);
    renderReceitaPorPlanoHome(usuarios, planos);
    renderTabelaEmpresas(usuarios);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ---------- SUPORTE PENDENTE ---------- */
async function carregarSuportePendente() {
  try {
    const itens = await Api.admin.suporte.listar();
    const pendentes = itens.filter((i) => !i.respondida);
    const container = document.getElementById('adm-suporte-pendente');
    const badge = document.getElementById('adm-suporte-count');

    if (pendentes.length === 0) {
      badge.classList.add('hidden');
      container.innerHTML = '<div class="empty-state" style="padding:1.5rem;">Nenhuma mensagem pendente — tudo respondido.</div>';
      return;
    }

    badge.textContent = pendentes.length;
    badge.classList.remove('hidden');

    container.innerHTML = pendentes.slice(0, 3).map((i) => `
      <div class="mini-list-row">
        <span class="mini-list-dot"></span>
        <div class="mini-list-body">
          <div class="mini-list-title">${escapeHtml(i.usuario_nome)}</div>
          <div class="mini-list-msg">${escapeHtml(i.mensagem)}</div>
        </div>
        <div class="mini-list-time">${formatDataRelativa(i.criado_em)}</div>
      </div>
    `).join('') + (pendentes.length > 3 ? `<div class="funil-resumo">+${pendentes.length - 3} outra(s) pendente(s)</div>` : '');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function carregarTudo() {
  carregarMetricas();
  carregarAnalisesHome();
  carregarSuportePendente();
}

document.getElementById('refresh-admin').addEventListener('click', carregarTudo);

carregarTudo();
