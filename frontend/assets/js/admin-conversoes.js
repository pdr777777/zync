Auth.requireAuth();

if (!Auth.isAdmin()) {
  window.location.href = 'dashboard.html';
}

const STATUS_LABELS = {
  ativa: 'Ativa (pagando)',
  pendente: 'Pendente (Pix gerado, não pago)',
  cancelada: 'Cancelada',
  expirada: 'Expirada',
  nunca_assinou: 'Nunca iniciou assinatura',
};

function renderBarlist(container, entradas, formatarValor) {
  if (entradas.length === 0) {
    container.innerHTML = '<div class="integracao-empty">Sem dados suficientes ainda.</div>';
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

function renderFunil(usuarios) {
  const totalCadastros = usuarios.length;
  const iniciaramCheckout = usuarios.filter((u) => u.assinatura_status != null).length;
  const pagantes = usuarios.filter((u) => u.assinatura_status === 'ativa').length;

  const entradas = [
    ['Cadastrados', totalCadastros],
    ['Iniciaram checkout (geraram Pix)', iniciaramCheckout],
    ['Pagantes (assinatura ativa)', pagantes],
  ];

  renderBarlist(document.getElementById('conv-funil'), entradas, (n) => n);

  const taxa = totalCadastros ? Math.round((pagantes / totalCadastros) * 1000) / 10 : 0;
  document.getElementById('conv-total').textContent = totalCadastros;
  document.getElementById('conv-taxa').textContent = `${taxa}%`;
  document.getElementById('conv-ativas').textContent = pagantes;
}

function renderPorStatus(usuarios) {
  const contagem = {};
  usuarios.forEach((u) => {
    const chave = u.assinatura_status || 'nunca_assinou';
    contagem[chave] = (contagem[chave] || 0) + 1;
  });

  const entradas = Object.entries(contagem).map(([status, total]) => [STATUS_LABELS[status] || status, total]);
  renderBarlist(document.getElementById('conv-status'), entradas, (n) => n);
}

async function carregarConversoes() {
  try {
    const usuarios = await Api.admin.usuarios();
    renderFunil(usuarios);
    renderPorStatus(usuarios);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

carregarConversoes();
