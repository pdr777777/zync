function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const slug = new URLSearchParams(window.location.search).get('slug');
let produtoSelecionadoId = null;

async function carregarLoja() {
  if (!slug) {
    document.getElementById('loja-nome').textContent = 'Loja não encontrada';
    return;
  }

  try {
    const { nomeLoja, produtos } = await Api.catalogoPublico.obter(slug);
    document.getElementById('loja-nome').textContent = nomeLoja;
    renderProdutos(produtos);
  } catch (err) {
    document.getElementById('loja-nome').textContent = 'Loja não encontrada';
    showToast(err.message, 'error');
  }
}

function renderProdutos(produtos) {
  const grid = document.getElementById('loja-grid');

  if (produtos.length === 0) {
    grid.innerHTML = '<p style="color:var(--cinza); text-align:center;">Nenhum produto disponível por aqui ainda.</p>';
    return;
  }

  grid.innerHTML = produtos.map((p) => `
    <div class="loja-card" data-id="${p.id}">
      ${p.foto_url
        ? `<img class="loja-card-foto" src="${escapeHtml(p.foto_url)}" alt="">`
        : `<div class="loja-card-foto"></div>`}
      <div class="loja-card-nome">${escapeHtml(p.nome)}</div>
      ${p.descricao ? `<div class="loja-card-descricao">${escapeHtml(p.descricao)}</div>` : ''}
      <div class="loja-card-preco">${formatarPreco(p.preco)}</div>
      <button type="button" class="btn btn-primary btn-sm" data-acao="pedir">Pedir</button>
    </div>
  `).join('');

  grid.querySelectorAll('[data-acao="pedir"]').forEach((btn) => {
    const card = btn.closest('.loja-card');
    const produto = produtos.find((p) => String(p.id) === card.dataset.id);

    btn.addEventListener('click', () => {
      produtoSelecionadoId = produto.id;
      document.getElementById('solicitar-titulo').textContent = `Pedir: ${produto.nome}`;
      document.getElementById('form-solicitar').reset();
      document.getElementById('solicitar-modal').classList.add('visible');
    });
  });
}

const modal = document.getElementById('solicitar-modal');
modal.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', () => modal.classList.remove('visible')));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('visible'); });

document.getElementById('form-solicitar').addEventListener('submit', async (e) => {
  e.preventDefault();

  const dados = {
    produtoId: produtoSelecionadoId,
    nomeCliente: document.getElementById('solicitar-nome').value.trim(),
    telefoneCliente: document.getElementById('solicitar-telefone').value.trim() || null,
    mensagem: document.getElementById('solicitar-mensagem').value.trim() || null,
  };

  const btn = document.getElementById('solicitar-submit');
  const label = document.getElementById('solicitar-submit-label');
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span>';

  try {
    await Api.catalogoPublico.solicitar(slug, dados);
    modal.classList.remove('visible');
    showToast('Pedido enviado! Você será contatado em breve.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = 'Enviar pedido';
  }
});

carregarLoja();
