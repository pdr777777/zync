Auth.requireAuth();

async function carregarPerfil() {
  try {
    const usuario = await Api.auth.me();
    document.getElementById('perfil-nome').value = usuario.nome;
    document.getElementById('perfil-email').value = usuario.email;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('form-perfil').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = document.getElementById('perfil-nome').value.trim();
  const email = document.getElementById('perfil-email').value.trim();
  if (!nome || !email) return;

  const btn = document.getElementById('perfil-submit');
  const label = document.getElementById('perfil-submit-label');
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span>';

  try {
    const usuario = await Api.auth.atualizarMe({ nome, email });
    const sessao = Auth.getUsuario();
    Auth.setSession(Auth.getToken(), { ...sessao, nome: usuario.nome, email: usuario.email });
    renderUsuario();
    showToast('Perfil atualizado com sucesso', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = 'Salvar alterações';
  }
});

document.getElementById('form-senha').addEventListener('submit', async (e) => {
  e.preventDefault();
  const senha_atual = document.getElementById('senha-atual').value;
  const senha = document.getElementById('senha-nova').value;
  const confirmar = document.getElementById('senha-confirmar').value;

  if (senha !== confirmar) {
    showToast('As senhas não coincidem', 'error');
    return;
  }

  const btn = document.getElementById('senha-submit');
  const label = document.getElementById('senha-submit-label');
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span>';

  try {
    await Api.auth.atualizarMe({ senha, senha_atual });
    showToast('Senha alterada com sucesso', 'success');
    document.getElementById('form-senha').reset();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = 'Alterar senha';
  }
});

carregarPerfil();
