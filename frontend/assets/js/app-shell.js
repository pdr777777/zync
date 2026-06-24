function iniciais(nome) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function renderUsuario() {
  const usuario = Auth.getUsuario();
  if (!usuario) return;
  document.getElementById('user-avatar').textContent = iniciais(usuario.nome);
  document.getElementById('user-name').textContent = usuario.nome;
  document.getElementById('user-email').textContent = usuario.email;
}

document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());

renderUsuario();
