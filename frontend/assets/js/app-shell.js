function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function iniciais(nome) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function formatDataHoraCurta(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function apenasDigitos(s) {
  return s.replace(/\D/g, '');
}

function mascararCpf(valor) {
  return apenasDigitos(valor)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function mascararTelefone(valor) {
  const d = apenasDigitos(valor).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '');
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '');
}

const NOTIF_ICONES = {
  lead_criado: '🆕',
  mensagem_recebida: '💬',
  agendamento_criado: '📅',
};

function renderUsuario() {
  const usuario = Auth.getUsuario();
  if (!usuario) return;

  const avatar = document.getElementById('user-avatar');
  if (usuario.foto_url) {
    avatar.innerHTML = `<img src="${escapeHtml(usuario.foto_url)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
  } else {
    avatar.textContent = iniciais(usuario.nome);
  }

  document.getElementById('user-name').textContent = usuario.nome;
  document.getElementById('user-email').textContent = usuario.email;

  const ehPaginaAdmin = window.location.pathname.endsWith('admin.html');
  const nav = document.querySelector('.sidebar-nav');
  if (Auth.isAdmin() && !ehPaginaAdmin && nav && !nav.querySelector('[data-admin-link]')) {
    const link = document.createElement('a');
    link.href = 'admin.html';
    link.className = 'sidebar-item';
    link.dataset.adminLink = 'true';
    link.textContent = '🛠️ Admin do SaaS';
    nav.appendChild(link);
  }
}

document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());

/* ---------- LOGO COMO LINK PRA HOME ---------- */
(function tornarLogoClicavel() {
  const logo = document.querySelector('.sidebar-logo');
  if (!logo || logo.tagName === 'A') return;

  const link = document.createElement('a');
  link.href = '../../index.html';
  link.className = logo.className;
  link.innerHTML = logo.innerHTML;
  logo.replaceWith(link);
})();

/* ---------- NOTIFICAÇÕES ---------- */
(function injetarNotificacoes() {
  const sidebar = document.querySelector('.app-sidebar');
  const nav = document.querySelector('.sidebar-nav');
  if (!sidebar || !nav || document.getElementById('notif-bell')) return;

  const wrap = document.createElement('div');
  wrap.className = 'notif-wrap';
  wrap.innerHTML = `
    <button class="notif-bell" id="notif-bell" aria-label="Notificações" type="button">
      🔔<span class="notif-badge hidden" id="notif-badge">0</span>
    </button>
    <div class="notif-dropdown hidden" id="notif-dropdown">
      <div class="notif-dropdown-header">
        <span>Notificações</span>
        <button type="button" id="notif-marcar-todas" class="btn btn-ghost btn-sm">Marcar todas como lidas</button>
      </div>
      <div class="notif-list" id="notif-list"><div class="empty-state" style="padding:1.5rem;"><span class="spinner"></span></div></div>
    </div>
  `;
  sidebar.insertBefore(wrap, nav);

  const bell = document.getElementById('notif-bell');
  const dropdown = document.getElementById('notif-dropdown');

  async function carregarContagem() {
    try {
      const { naoLidas } = await Api.notificacoes.contagem();
      const badge = document.getElementById('notif-badge');
      if (naoLidas > 0) {
        badge.textContent = naoLidas > 99 ? '99+' : naoLidas;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    } catch {
      /* silencioso -- não derruba a página por causa do sininho */
    }
  }

  async function carregarLista() {
    const lista = document.getElementById('notif-list');
    try {
      const notificacoes = await Api.notificacoes.listar({ limit: 20 });

      if (notificacoes.length === 0) {
        lista.innerHTML = '<div class="empty-state" style="padding:1.5rem;">Nenhuma notificação ainda</div>';
        return;
      }

      lista.innerHTML = notificacoes.map((n) => `
        <div class="notif-item ${n.lida ? '' : 'nao-lida'}" data-id="${n.id}">
          <span class="notif-item-icon">${NOTIF_ICONES[n.tipo] || '🔔'}</span>
          <div class="notif-item-body">
            <div class="notif-item-msg">${escapeHtml(n.mensagem)}</div>
            <div class="notif-item-data">${formatDataHoraCurta(n.criado_em)}</div>
          </div>
        </div>
      `).join('');

      lista.querySelectorAll('.notif-item.nao-lida').forEach((el) => {
        el.addEventListener('click', async () => {
          try {
            await Api.notificacoes.marcarLida(el.dataset.id);
            el.classList.remove('nao-lida');
            carregarContagem();
          } catch {
            /* ignora */
          }
        });
      });
    } catch (err) {
      lista.innerHTML = `<div class="empty-state" style="padding:1.5rem;">${escapeHtml(err.message)}</div>`;
    }
  }

  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden')) carregarLista();
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) dropdown.classList.add('hidden');
  });

  document.getElementById('notif-marcar-todas').addEventListener('click', async () => {
    try {
      await Api.notificacoes.marcarTodasLidas();
      carregarContagem();
      carregarLista();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  carregarContagem();
  setInterval(carregarContagem, 30000);
})();

renderUsuario();
