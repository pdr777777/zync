function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function iniciais(nome) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function renderUsuario() {
  const usuario = Auth.getUsuario();
  if (!usuario) return;
  document.getElementById('user-avatar').textContent = iniciais(usuario.nome);
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

renderUsuario();
