Auth.requireAuth();

async function carregarPerfil() {
  try {
    const usuario = await Api.auth.me();
    document.getElementById('perfil-nome').value = usuario.nome;
    document.getElementById('perfil-email').value = usuario.email;
    document.getElementById('perfil-foto').value = usuario.foto_url || '';
    document.getElementById('perfil-idade').value = usuario.idade ?? '';
    document.getElementById('perfil-cpf').value = usuario.cpf || '';
    document.getElementById('perfil-telefone').value = usuario.telefone || '';
    document.getElementById('perfil-instagram').value = usuario.instagram || '';
    document.getElementById('perfil-facebook').value = usuario.facebook || '';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('perfil-cpf').addEventListener('input', (e) => { e.target.value = mascararCpf(e.target.value); });
document.getElementById('perfil-telefone').addEventListener('input', (e) => { e.target.value = mascararTelefone(e.target.value); });

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

document.getElementById('form-pessoal').addEventListener('submit', async (e) => {
  e.preventDefault();

  const idadeRaw = document.getElementById('perfil-idade').value;
  const dados = {
    foto_url: document.getElementById('perfil-foto').value.trim() || null,
    idade: idadeRaw === '' ? null : Number(idadeRaw),
    cpf: document.getElementById('perfil-cpf').value.trim() || null,
    telefone: document.getElementById('perfil-telefone').value.trim() || null,
    instagram: document.getElementById('perfil-instagram').value.trim() || null,
    facebook: document.getElementById('perfil-facebook').value.trim() || null,
  };

  const btn = document.getElementById('pessoal-submit');
  const label = document.getElementById('pessoal-submit-label');
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span>';

  try {
    const usuario = await Api.auth.atualizarMe(dados);
    const sessao = Auth.getUsuario();
    Auth.setSession(Auth.getToken(), { ...sessao, foto_url: usuario.foto_url });
    renderUsuario();
    showToast('Informações salvas com sucesso', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = 'Salvar informações';
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
