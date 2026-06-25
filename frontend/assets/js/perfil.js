Auth.requireAuth();

let fotoAtual = null;
let fotoAlterada = false;

function atualizarPreviewFoto(url) {
  const preview = document.getElementById('foto-preview');
  if (url) {
    preview.innerHTML = `<img src="${url}" alt="">`;
    document.getElementById('foto-remover').classList.remove('hidden');
  } else {
    preview.textContent = iniciais(document.getElementById('perfil-nome').value || '?');
    document.getElementById('foto-remover').classList.add('hidden');
  }
}

async function carregarPerfil() {
  try {
    const usuario = await Api.auth.me();
    document.getElementById('perfil-nome').value = usuario.nome;
    document.getElementById('perfil-email').value = usuario.email;
    document.getElementById('perfil-idade').value = usuario.idade ?? '';
    document.getElementById('perfil-cpf').value = usuario.cpf || '';
    document.getElementById('perfil-telefone').value = usuario.telefone || '';
    document.getElementById('perfil-instagram').value = usuario.instagram || '';
    document.getElementById('perfil-facebook').value = usuario.facebook || '';

    fotoAtual = usuario.foto_url || null;
    fotoAlterada = false;
    atualizarPreviewFoto(fotoAtual);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ---------- UPLOAD E RECORTE DA FOTO ---------- */
(function configurarCropFoto() {
  const VIEWPORT = 240;
  const SAIDA = 320;

  const modal = document.getElementById('foto-crop-modal');
  const viewport = document.getElementById('crop-viewport');
  const cropImg = document.getElementById('crop-img');
  const zoomSlider = document.getElementById('crop-zoom');

  let baseScale = 1;
  let zoom = 1;
  let posX = 0;
  let posY = 0;
  let arrastando = false;
  let ultimoX = 0;
  let ultimoY = 0;

  function aplicarCrop() {
    const escala = baseScale * zoom;
    const largura = cropImg.naturalWidth * escala;
    const altura = cropImg.naturalHeight * escala;
    const minX = VIEWPORT - largura;
    const minY = VIEWPORT - altura;

    posX = Math.min(0, Math.max(minX, posX));
    posY = Math.min(0, Math.max(minY, posY));

    cropImg.style.width = `${largura}px`;
    cropImg.style.height = `${altura}px`;
    cropImg.style.left = `${posX}px`;
    cropImg.style.top = `${posY}px`;
  }

  function abrirModal() {
    modal.classList.add('visible');
  }

  function fecharModal() {
    modal.classList.remove('visible');
  }

  document.getElementById('foto-escolher').addEventListener('click', () => {
    document.getElementById('foto-input').click();
  });

  document.getElementById('foto-input').addEventListener('change', (e) => {
    const arquivo = e.target.files[0];
    e.target.value = '';
    if (!arquivo) return;

    if (!arquivo.type.startsWith('image/')) {
      showToast('Selecione um arquivo de imagem', 'error');
      return;
    }

    const leitor = new FileReader();
    leitor.onload = () => {
      cropImg.onload = () => {
        baseScale = Math.max(VIEWPORT / cropImg.naturalWidth, VIEWPORT / cropImg.naturalHeight);
        zoom = 1;
        zoomSlider.value = '1';
        posX = (VIEWPORT - cropImg.naturalWidth * baseScale) / 2;
        posY = (VIEWPORT - cropImg.naturalHeight * baseScale) / 2;
        aplicarCrop();
        abrirModal();
      };
      cropImg.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });

  document.getElementById('foto-remover').addEventListener('click', () => {
    fotoAtual = null;
    fotoAlterada = true;
    atualizarPreviewFoto(null);
  });

  viewport.addEventListener('pointerdown', (e) => {
    arrastando = true;
    ultimoX = e.clientX;
    ultimoY = e.clientY;
    viewport.classList.add('dragging');
    viewport.setPointerCapture(e.pointerId);
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!arrastando) return;
    posX += e.clientX - ultimoX;
    posY += e.clientY - ultimoY;
    ultimoX = e.clientX;
    ultimoY = e.clientY;
    aplicarCrop();
  });

  function pararArraste() {
    arrastando = false;
    viewport.classList.remove('dragging');
  }
  viewport.addEventListener('pointerup', pararArraste);
  viewport.addEventListener('pointercancel', pararArraste);

  zoomSlider.addEventListener('input', () => {
    const novoZoom = Number(zoomSlider.value);
    const escalaAntiga = baseScale * zoom;
    const escalaNova = baseScale * novoZoom;
    const centro = VIEWPORT / 2;
    const imgX = (centro - posX) / escalaAntiga;
    const imgY = (centro - posY) / escalaAntiga;
    zoom = novoZoom;
    posX = centro - imgX * escalaNova;
    posY = centro - imgY * escalaNova;
    aplicarCrop();
  });

  modal.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', fecharModal));
  modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });

  document.getElementById('crop-confirmar').addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = SAIDA;
    canvas.height = SAIDA;
    const ctx = canvas.getContext('2d');
    const proporcao = SAIDA / VIEWPORT;
    const escala = baseScale * zoom;
    const largura = cropImg.naturalWidth * escala * proporcao;
    const altura = cropImg.naturalHeight * escala * proporcao;
    ctx.drawImage(cropImg, posX * proporcao, posY * proporcao, largura, altura);

    fotoAtual = canvas.toDataURL('image/jpeg', 0.85);
    fotoAlterada = true;
    atualizarPreviewFoto(fotoAtual);
    fecharModal();
  });
})();

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
    idade: idadeRaw === '' ? null : Number(idadeRaw),
    cpf: document.getElementById('perfil-cpf').value.trim() || null,
    telefone: document.getElementById('perfil-telefone').value.trim() || null,
    instagram: document.getElementById('perfil-instagram').value.trim() || null,
    facebook: document.getElementById('perfil-facebook').value.trim() || null,
  };
  if (fotoAlterada) dados.foto_url = fotoAtual;

  const btn = document.getElementById('pessoal-submit');
  const label = document.getElementById('pessoal-submit-label');
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span>';

  try {
    const usuario = await Api.auth.atualizarMe(dados);
    const sessao = Auth.getUsuario();
    Auth.setSession(Auth.getToken(), { ...sessao, foto_url: usuario.foto_url });
    fotoAtual = usuario.foto_url || null;
    fotoAlterada = false;
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

/* ---------- INTEGRAÇÕES (WEBHOOKS) ---------- */
const ROTULOS_EVENTO = {
  lead_criado: 'Novo lead',
  lead_status_alterado: 'Status do lead mudou',
  agendamento_criado: 'Novo agendamento',
  pagamento_aprovado: 'Pagamento aprovado',
};

function renderIntegracoes(lista) {
  const container = document.getElementById('integracoes-list');

  if (lista.length === 0) {
    container.innerHTML = '<div class="integracao-empty">Nenhuma integração cadastrada ainda.</div>';
    return;
  }

  container.innerHTML = lista.map((it) => `
    <div class="integracao-row" data-id="${it.id}">
      <div class="integracao-info">
        <div class="integracao-url">${escapeHtml(it.url)}</div>
        <div class="integracao-eventos">
          ${it.eventos.map((ev) => `<span class="tag-chip">${escapeHtml(ROTULOS_EVENTO[ev] || ev)}</span>`).join('')}
          <span class="badge ${it.ativo ? 'badge-ativa' : 'badge-cancelada'}">${it.ativo ? 'Ativo' : 'Inativo'}</span>
        </div>
        <div class="integracao-secret">
          Segredo (pra validar a assinatura): ${escapeHtml(it.secret.slice(0, 12))}…
          <button type="button" data-acao="copiar-secret" data-secret="${escapeHtml(it.secret)}">Copiar</button>
        </div>
      </div>
      <div class="integracao-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-acao="testar">Testar</button>
        <button type="button" class="btn btn-secondary btn-sm" data-acao="alternar">${it.ativo ? 'Desativar' : 'Ativar'}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-acao="remover" aria-label="Remover">${icon('x', 14)}</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-acao]').forEach((btn) => {
    const id = btn.closest('.integracao-row').dataset.id;
    const item = lista.find((i) => String(i.id) === id);

    btn.addEventListener('click', async () => {
      if (btn.dataset.acao === 'copiar-secret') {
        await navigator.clipboard.writeText(btn.dataset.secret);
        showToast('Segredo copiado!', 'success');
        return;
      }

      if (btn.dataset.acao === 'testar') {
        btn.disabled = true;
        try {
          const resultado = await Api.integracoes.testar(id);
          showToast(resultado.sucesso ? 'Teste enviado com sucesso!' : 'A URL não respondeu corretamente', resultado.sucesso ? 'success' : 'error');
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      }

      if (btn.dataset.acao === 'alternar') {
        try {
          await Api.integracoes.atualizar(id, { ativo: !item.ativo });
          carregarIntegracoes();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }

      if (btn.dataset.acao === 'remover') {
        if (!confirm('Remover essa integração?')) return;
        try {
          await Api.integracoes.remover(id);
          carregarIntegracoes();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

async function carregarIntegracoes() {
  try {
    const lista = await Api.integracoes.listar();
    renderIntegracoes(lista);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

(function configurarModalIntegracao() {
  const modal = document.getElementById('integracao-modal');
  const form = document.getElementById('form-integracao');

  function abrirModal() {
    modal.classList.add('visible');
  }

  function fecharModal() {
    modal.classList.remove('visible');
    form.reset();
  }

  document.getElementById('integracao-nova').addEventListener('click', abrirModal);
  modal.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', fecharModal));
  modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const url = document.getElementById('integracao-url').value;
    const eventos = Array.from(form.querySelectorAll('input[name="integracao-evento"]:checked')).map((c) => c.value);

    if (eventos.length === 0) {
      showToast('Escolha pelo menos um evento', 'error');
      return;
    }

    const btn = document.getElementById('integracao-submit');
    const label = document.getElementById('integracao-submit-label');
    btn.disabled = true;
    label.innerHTML = '<span class="spinner"></span>';

    try {
      await Api.integracoes.criar({ url, eventos });
      fecharModal();
      carregarIntegracoes();
      showToast('Integração criada com sucesso', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      label.textContent = 'Criar integração';
    }
  });
})();

carregarPerfil();
carregarIntegracoes();
