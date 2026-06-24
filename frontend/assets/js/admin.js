Auth.requireAuth();

if (!Auth.isAdmin()) {
  window.location.href = 'dashboard.html';
}

const STATUS_ASSINATURA_LABELS = {
  pendente: 'Pendente',
  ativa: 'Ativa',
  cancelada: 'Cancelada',
  expirada: 'Expirada',
};

let planosCache = [];
const usuarioAtual = Auth.getUsuario();

function formatBRL(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

/* ---------- MÉTRICAS ---------- */
async function carregarMetricas() {
  try {
    const dados = await Api.admin.metricas();
    document.getElementById('adm-total-usuarios').textContent = dados.totalUsuarios;
    document.getElementById('adm-mrr').textContent = formatBRL(dados.mrr);
    document.getElementById('adm-ativas').textContent = dados.assinaturasPorStatus.ativa || 0;
    const pendentesCanceladas = (dados.assinaturasPorStatus.pendente || 0) + (dados.assinaturasPorStatus.cancelada || 0);
    document.getElementById('adm-pendentes').textContent = pendentesCanceladas;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ---------- USUÁRIOS ---------- */
async function carregarUsuarios() {
  const lista = document.getElementById('admin-users-list');
  try {
    const usuarios = await Api.admin.usuarios();

    if (usuarios.length === 0) {
      lista.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏢</div><h3>Nenhuma empresa ainda</h3></div>';
      return;
    }

    lista.innerHTML = usuarios.map((u) => `
      <div class="agenda-row" data-id="${u.id}">
        <div class="agenda-info">
          <div class="agenda-lead">${escapeHtml(u.nome)} ${u.is_admin ? '<span class="k-tag">admin</span>' : ''}</div>
          <div class="agenda-servico">${escapeHtml(u.email)} · cliente desde ${formatData(u.criado_em)}</div>
        </div>
        <div class="agenda-actions">
          ${u.plano_nome ? `<span class="agenda-servico">${escapeHtml(u.plano_nome)}</span>` : ''}
          ${u.assinatura_status ? `<span class="badge badge-${u.assinatura_status}">${STATUS_ASSINATURA_LABELS[u.assinatura_status] || u.assinatura_status}</span>` : '<span class="agenda-servico">Sem assinatura</span>'}
          <button class="btn btn-sm ${u.is_admin ? 'btn-danger' : 'btn-secondary'}" data-action="toggle-admin" data-id="${u.id}" data-atual="${u.is_admin ? 1 : 0}">
            ${u.is_admin ? 'Remover admin' : 'Tornar admin'}
          </button>
        </div>
      </div>
    `).join('');

    lista.querySelectorAll('[data-action="toggle-admin"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const atual = btn.dataset.atual === '1';

        if (id === usuarioAtual.id && atual) {
          showToast('Você não pode remover seu próprio acesso de administrador', 'error');
          return;
        }

        try {
          await Api.admin.definirAdmin(id, !atual);
          showToast('Acesso atualizado', 'success');
          carregarUsuarios();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ---------- PLANOS ---------- */
async function carregarPlanos() {
  const lista = document.getElementById('admin-planos-list');
  try {
    planosCache = await Api.admin.planos.listar();

    lista.innerHTML = planosCache.map((p) => {
      const sufixo = p.intervalo_dias === 30 ? '/mês' : `/${p.intervalo_dias} dias`;
      return `
        <div class="agenda-row" data-id="${p.id}">
          <div class="agenda-info">
            <div class="agenda-lead">${escapeHtml(p.nome)}</div>
            <div class="agenda-servico">${formatBRL(p.preco)}${sufixo}</div>
          </div>
          <div class="agenda-actions">
            <span class="badge ${p.ativo ? 'badge-ativa' : 'badge-expirada'}">${p.ativo ? 'Ativo' : 'Inativo'}</span>
            <button class="btn btn-secondary btn-sm" data-action="editar-plano" data-id="${p.id}">Editar</button>
          </div>
        </div>
      `;
    }).join('');

    lista.querySelectorAll('[data-action="editar-plano"]').forEach((btn) => {
      btn.addEventListener('click', () => abrirPlanoModal(Number(btn.dataset.id)));
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

const planoModal = document.getElementById('plano-modal');

function abrirPlanoModal(planoId) {
  const plano = planoId ? planosCache.find((p) => p.id === planoId) : null;

  document.getElementById('plano-modal-title').textContent = plano ? 'Editar plano' : 'Novo plano';
  document.getElementById('pl-id').value = plano ? plano.id : '';
  document.getElementById('pl-nome').value = plano ? plano.nome : '';
  document.getElementById('pl-preco').value = plano ? plano.preco : '';
  document.getElementById('pl-intervalo').value = plano ? plano.intervalo_dias : 30;
  document.getElementById('pl-ativo').value = plano ? String(plano.ativo) : '1';
  document.getElementById('pl-ativo-field').style.display = plano ? 'block' : 'none';

  planoModal.classList.add('visible');
}

function fecharPlanoModal() {
  planoModal.classList.remove('visible');
  document.getElementById('plano-form').reset();
}

document.getElementById('open-new-plano').addEventListener('click', () => abrirPlanoModal(null));
planoModal.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', fecharPlanoModal));
planoModal.addEventListener('click', (e) => { if (e.target === planoModal) fecharPlanoModal(); });

document.getElementById('plano-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('pl-id').value;
  const dados = {
    nome: document.getElementById('pl-nome').value.trim(),
    preco: Number(document.getElementById('pl-preco').value),
    intervaloDias: Number(document.getElementById('pl-intervalo').value),
  };
  if (id) dados.ativo = document.getElementById('pl-ativo').value === '1';

  const btn = document.getElementById('plano-submit');
  const label = document.getElementById('plano-submit-label');
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span>';

  try {
    if (id) {
      await Api.admin.planos.atualizar(id, dados);
    } else {
      await Api.admin.planos.criar(dados);
    }
    showToast('Plano salvo', 'success');
    fecharPlanoModal();
    carregarPlanos();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = 'Salvar';
  }
});

document.getElementById('refresh-admin').addEventListener('click', () => {
  carregarMetricas();
  carregarUsuarios();
  carregarPlanos();
});

carregarMetricas();
carregarUsuarios();
carregarPlanos();
