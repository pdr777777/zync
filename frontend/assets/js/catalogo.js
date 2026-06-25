Auth.requireAuth();

let produtoFotoAtual = null;
let produtoEditandoId = null;

function atualizarPreviewFotoProduto(url) {
  const preview = document.getElementById('produto-foto-preview');
  if (url) {
    preview.innerHTML = `<img src="${url}" alt="">`;
    document.getElementById('produto-foto-remover').classList.remove('hidden');
  } else {
    preview.textContent = '--';
    document.getElementById('produto-foto-remover').classList.add('hidden');
  }
}

/* ---------- LINK DE VENDAS ---------- */
async function carregarLink() {
  try {
    const { url } = await Api.catalogo.link();
    const el = document.getElementById('catalogo-link-url');
    el.textContent = url;
    document.getElementById('catalogo-copiar-link').addEventListener('click', async () => {
      await navigator.clipboard.writeText(url);
      showToast('Link copiado!', 'success');
    });
  } catch (err) {
    document.getElementById('catalogo-link-url').textContent = 'Erro ao carregar link';
    showToast(err.message, 'error');
  }
}

/* ---------- LISTA DE PRODUTOS ---------- */
function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderProdutos(lista) {
  const container = document.getElementById('produtos-list');

  if (lista.length === 0) {
    container.innerHTML = '<div class="produto-empty">Nenhum produto cadastrado ainda.</div>';
    return;
  }

  container.innerHTML = lista.map((p) => `
    <div class="produto-row" data-id="${p.id}">
      ${p.foto_url
        ? `<img class="produto-foto" src="${escapeHtml(p.foto_url)}" alt="">`
        : `<div class="produto-foto"></div>`}
      <div class="produto-info">
        <div class="produto-nome">${escapeHtml(p.nome)}</div>
        <div class="produto-preco">${formatarPreco(p.preco)}</div>
      </div>
      <div class="produto-actions">
        <span class="badge ${p.ativo ? 'badge-ativa' : 'badge-cancelada'}">${p.ativo ? 'Ativo' : 'Inativo'}</span>
        <button type="button" class="btn btn-secondary btn-sm" data-acao="alternar">${p.ativo ? 'Desativar' : 'Ativar'}</button>
        <button type="button" class="btn btn-secondary btn-sm" data-acao="editar">Editar</button>
        <button type="button" class="btn btn-ghost btn-sm" data-acao="remover" aria-label="Remover">${icon('x', 14)}</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-acao]').forEach((btn) => {
    const id = btn.closest('.produto-row').dataset.id;
    const item = lista.find((p) => String(p.id) === id);

    btn.addEventListener('click', async () => {
      if (btn.dataset.acao === 'alternar') {
        try {
          await Api.catalogo.atualizar(id, { ativo: !item.ativo });
          carregarProdutos();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }

      if (btn.dataset.acao === 'editar') {
        abrirModalProduto(item);
      }

      if (btn.dataset.acao === 'remover') {
        if (!confirm('Remover esse produto?')) return;
        try {
          await Api.catalogo.remover(id);
          carregarProdutos();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

async function carregarProdutos() {
  try {
    const lista = await Api.catalogo.listar();
    renderProdutos(lista);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ---------- MODAL DE PRODUTO (criar/editar) ---------- */
function abrirModalProduto(produto = null) {
  const form = document.getElementById('form-produto');
  form.reset();

  produtoEditandoId = produto ? produto.id : null;
  produtoFotoAtual = produto ? produto.foto_url || null : null;
  atualizarPreviewFotoProduto(produtoFotoAtual);

  document.getElementById('produto-modal-titulo').textContent = produto ? 'Editar produto' : 'Novo produto';
  document.getElementById('produto-nome').value = produto ? produto.nome : '';
  document.getElementById('produto-descricao').value = produto ? (produto.descricao || '') : '';
  document.getElementById('produto-preco').value = produto ? produto.preco : '';

  document.getElementById('produto-modal').classList.add('visible');
}

function fecharModalProduto() {
  document.getElementById('produto-modal').classList.remove('visible');
}

document.getElementById('produto-novo').addEventListener('click', () => abrirModalProduto());
document.getElementById('produto-modal').querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', fecharModalProduto));
document.getElementById('produto-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('produto-modal')) fecharModalProduto();
});

document.getElementById('form-produto').addEventListener('submit', async (e) => {
  e.preventDefault();

  const dados = {
    nome: document.getElementById('produto-nome').value.trim(),
    descricao: document.getElementById('produto-descricao').value.trim() || null,
    preco: Number(document.getElementById('produto-preco').value),
    fotoUrl: produtoFotoAtual,
  };

  const btn = document.getElementById('produto-submit');
  const label = document.getElementById('produto-submit-label');
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span>';

  try {
    if (produtoEditandoId) {
      await Api.catalogo.atualizar(produtoEditandoId, dados);
    } else {
      await Api.catalogo.criar(dados);
    }
    fecharModalProduto();
    carregarProdutos();
    showToast('Produto salvo com sucesso', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = 'Salvar produto';
  }
});

document.getElementById('produto-foto-remover').addEventListener('click', () => {
  produtoFotoAtual = null;
  atualizarPreviewFotoProduto(null);
});

/* ---------- UPLOAD E RECORTE DA FOTO DO PRODUTO ---------- */
(function configurarCropFotoProduto() {
  const VIEWPORT = 200;
  const SAIDA = 320;

  const modal = document.getElementById('produto-foto-crop-modal');
  const viewport = document.getElementById('produto-crop-viewport');
  const cropImg = document.getElementById('produto-crop-img');
  const zoomSlider = document.getElementById('produto-crop-zoom');

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

  document.getElementById('produto-foto-escolher').addEventListener('click', () => {
    document.getElementById('produto-foto-input').click();
  });

  document.getElementById('produto-foto-input').addEventListener('change', (e) => {
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

  document.getElementById('produto-crop-confirmar').addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = SAIDA;
    canvas.height = SAIDA;
    const ctx = canvas.getContext('2d');
    const proporcao = SAIDA / VIEWPORT;
    const escala = baseScale * zoom;
    const largura = cropImg.naturalWidth * escala * proporcao;
    const altura = cropImg.naturalHeight * escala * proporcao;
    ctx.drawImage(cropImg, posX * proporcao, posY * proporcao, largura, altura);

    produtoFotoAtual = canvas.toDataURL('image/jpeg', 0.85);
    atualizarPreviewFotoProduto(produtoFotoAtual);
    fecharModal();
  });
})();

carregarLink();
carregarProdutos();
