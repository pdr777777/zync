Auth.requireAuth();

const STATUS_AGENDAMENTO_LABELS = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  concluido: 'Concluído',
};

let agendamentosCache = [];
let leadsMap = new Map();

function formatDataHora(iso) {
  const d = new Date(iso);
  return {
    data: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
}

function toMysqlDatetime(localValue) {
  return localValue.length === 16 ? `${localValue.replace('T', ' ')}:00` : localValue.replace('T', ' ');
}

async function carregarTudo() {
  try {
    const [agendamentos, leads] = await Promise.all([Api.agendamentos.listarTodos(), Api.leads.listar()]);
    agendamentosCache = agendamentos;
    leadsMap = new Map(leads.map((l) => [l.id, l.nome]));
    popularSelectLeads(leads);
    renderAgenda();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function popularSelectLeads(leads) {
  const select = document.getElementById('ag-lead');
  select.innerHTML = '<option value="">Selecione um lead…</option>' + leads.map((l) => `<option value="${l.id}">${escapeHtml(l.nome)}</option>`).join('');
}

function agruparPorPeriodo(agendamentos) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const grupos = { atrasados: [], hoje: [], proximos: [] };

  agendamentos.forEach((a) => {
    const diaAgendamento = new Date(a.data_hora);
    diaAgendamento.setHours(0, 0, 0, 0);

    if (diaAgendamento.getTime() === hoje.getTime()) {
      grupos.hoje.push(a);
    } else if (diaAgendamento < hoje) {
      grupos.atrasados.push(a);
    } else {
      grupos.proximos.push(a);
    }
  });

  return grupos;
}

function renderItemAgenda(a) {
  const { data, hora } = formatDataHora(a.data_hora);
  const nomeLead = leadsMap.get(a.lead_id) || `Lead #${a.lead_id}`;

  return `
    <div class="agenda-row" data-id="${a.id}">
      <div class="agenda-date">${data}<div class="agenda-date-sub">${hora}</div></div>
      <div class="agenda-info">
        <div class="agenda-lead">${escapeHtml(nomeLead)}</div>
        <div class="agenda-servico">${escapeHtml(a.servico || 'Sem serviço especificado')}</div>
      </div>
      <div class="agenda-actions">
        <span class="badge badge-${a.status}">${STATUS_AGENDAMENTO_LABELS[a.status] || a.status}</span>
        <select aria-label="Mudar status" data-action="status" data-id="${a.id}">
          ${Object.entries(STATUS_AGENDAMENTO_LABELS).map(([v, label]) => `<option value="${v}" ${v === a.status ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <button class="btn btn-danger btn-sm" data-action="excluir" data-id="${a.id}">Excluir</button>
      </div>
    </div>
  `;
}

function renderAgenda() {
  const container = document.getElementById('agenda-list');

  if (agendamentosCache.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h3>Nenhum agendamento ainda</h3><div>Crie o primeiro com o botão acima.</div></div>';
    return;
  }

  const grupos = agruparPorPeriodo(agendamentosCache);
  const secoes = [
    { chave: 'atrasados', titulo: '⚠️ Atrasados' },
    { chave: 'hoje', titulo: '📍 Hoje' },
    { chave: 'proximos', titulo: '📅 Próximos' },
  ];

  container.innerHTML = secoes
    .filter((s) => grupos[s.chave].length > 0)
    .map((s) => `
      <div class="agenda-section-title">${s.titulo} <span class="kanban-col-count" style="margin-left:0.5rem;">${grupos[s.chave].length}</span></div>
      ${grupos[s.chave].map(renderItemAgenda).join('')}
    `).join('');

  container.querySelectorAll('[data-action="status"]').forEach((select) => {
    select.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      try {
        await Api.agendamentos.atualizar(id, { status: e.target.value });
        const item = agendamentosCache.find((a) => String(a.id) === id);
        if (item) item.status = e.target.value;
        renderAgenda();
        showToast('Status atualizado', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  container.querySelectorAll('[data-action="excluir"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este agendamento?')) return;
      const id = btn.dataset.id;
      try {
        await Api.agendamentos.remover(id);
        agendamentosCache = agendamentosCache.filter((a) => String(a.id) !== id);
        renderAgenda();
        showToast('Agendamento excluído', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

/* ---------- MODAL: NOVO AGENDAMENTO ---------- */
const agendamentoModal = document.getElementById('agendamento-modal');

function abrirModal() {
  agendamentoModal.classList.add('visible');
  document.getElementById('ag-lead').focus();
}

function fecharModal() {
  agendamentoModal.classList.remove('visible');
  document.getElementById('new-agendamento-form').reset();
}

document.getElementById('open-new-agendamento').addEventListener('click', abrirModal);
agendamentoModal.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', fecharModal));
agendamentoModal.addEventListener('click', (e) => { if (e.target === agendamentoModal) fecharModal(); });

document.getElementById('new-agendamento-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const leadId = document.getElementById('ag-lead').value;
  const servico = document.getElementById('ag-servico').value.trim() || null;
  const dataHoraLocal = document.getElementById('ag-data').value;
  if (!leadId || !dataHoraLocal) return;

  const btn = document.getElementById('ag-submit');
  const label = document.getElementById('ag-submit-label');
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span>';

  try {
    await Api.agendamentos.criar(leadId, { servico, data_hora: toMysqlDatetime(dataHoraLocal) });
    showToast('Agendamento criado', 'success');
    fecharModal();
    carregarTudo();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = 'Agendar';
  }
});

carregarTudo();
