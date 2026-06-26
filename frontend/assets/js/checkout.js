Lang.aplicar();

let planosCache = [];
let planoSelecionadoId = null;
let pollHandle = null;

function formatBRL(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

function cpfValido(cpf) {
  const d = apenasDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;

  const calcularDigito = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += parseInt(d[i], 10) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(9) === parseInt(d[9], 10) && calcularDigito(10) === parseInt(d[10], 10);
}

document.getElementById('co-cpf').addEventListener('input', (e) => { e.target.value = mascararCpf(e.target.value); });
document.getElementById('co-telefone').addEventListener('input', (e) => { e.target.value = mascararTelefone(e.target.value); });

/* ---------- ABAS DE PAGAMENTO ---------- */
document.querySelectorAll('.method-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.method-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.payment-panel').forEach((p) => p.classList.add('hidden'));
    document.getElementById(`panel-${tab.dataset.method}`).classList.remove('hidden');
  });
});

/* ---------- PLANOS ---------- */
async function carregarPlanos() {
  try {
    planosCache = await Api.planos.listar();
    renderPlanos();
    document.getElementById('summary-teaser').classList.add('hidden');
    document.getElementById('summary-plans').classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderPlanos() {
  const params = new URLSearchParams(window.location.search);
  const planoQuery = (params.get('plano') || '').toLowerCase();
  const preSelecionado = planosCache.find((p) => p.nome.toLowerCase().includes(planoQuery));
  planoSelecionadoId = (preSelecionado || planosCache[0])?.id ?? null;

  const container = document.getElementById('plan-options');
  container.innerHTML = planosCache.map((p) => `
    <label class="plan-option">
      <input type="radio" name="plano" value="${p.id}" ${p.id === planoSelecionadoId ? 'checked' : ''}>
      <div class="plan-option-body">
        <div class="plan-option-nome">${p.nome}</div>
        <div class="plan-option-preco">${formatBRL(p.preco)}<span>${p.intervalo_dias === 30 ? '/mês' : `/${p.intervalo_dias} dias`}</span></div>
      </div>
    </label>
  `).join('');

  container.querySelectorAll('input[name="plano"]').forEach((input) => {
    input.addEventListener('change', (e) => {
      planoSelecionadoId = Number(e.target.value);
      atualizarTotal();
    });
  });

  atualizarTotal();
}

function atualizarTotal() {
  const plano = planosCache.find((p) => p.id === planoSelecionadoId);
  if (!plano) return;
  const sufixo = plano.intervalo_dias === 30 ? '/mês' : `/${plano.intervalo_dias} dias`;
  document.getElementById('co-total').textContent = `${formatBRL(plano.preco)}${sufixo}`;
  document.getElementById('checkout-submit-label').textContent = `Gerar Pix e assinar — ${formatBRL(plano.preco)}`;
}

/* ---------- ETAPA 1: CONTA ---------- */
async function iniciarEtapaCheckout() {
  document.getElementById('account-form').classList.add('hidden');
  document.getElementById('checkout-section').classList.remove('hidden');
  await carregarPlanos();
}

if (Auth.isAuthenticated()) {
  iniciarEtapaCheckout();
}

document.getElementById('account-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const nome = document.getElementById('co-nome').value.trim();
  const email = document.getElementById('co-email').value.trim();
  const senha = document.getElementById('co-senha').value;

  if (!nome || !email || senha.length < 8 || !/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
    showToast('Preencha seus dados corretamente (senha com mínimo 8 caracteres, com letras e números).', 'error');
    return;
  }

  const btn = document.getElementById('account-submit');
  const label = document.getElementById('account-submit-label');
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span>';

  try {
    await Api.register(nome, email, senha);
    const { token, usuario } = await Api.login(email, senha);
    Auth.setSession(token, usuario);
    await iniciarEtapaCheckout();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    label.textContent = 'Criar conta e continuar';
  }
});

/* ---------- ETAPA 2: GERAR PIX ---------- */
document.getElementById('checkout-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const cpf = document.getElementById('co-cpf').value;
  const telefone = document.getElementById('co-telefone').value;

  if (!planoSelecionadoId) {
    showToast('Escolha um plano antes de continuar', 'error');
    return;
  }
  if (!cpfValido(cpf)) {
    showToast('CPF inválido', 'error');
    return;
  }
  if (apenasDigitos(telefone).length < 10) {
    showToast('Telefone inválido', 'error');
    return;
  }

  const usuario = Auth.getUsuario();
  const btn = document.getElementById('checkout-submit');
  const label = document.getElementById('checkout-submit-label');
  const labelOriginal = label.textContent;
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span>';

  try {
    const resposta = await Api.assinaturas.checkout({
      planoId: planoSelecionadoId,
      nome: usuario.nome,
      cpf,
      email: usuario.email,
      telefone,
    });

    mostrarPix(resposta);
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    label.textContent = labelOriginal;
  }
});

/* ---------- ETAPA 3: PAGAR PIX + AGUARDAR ---------- */
function mostrarPix(resposta) {
  document.getElementById('checkout-section').classList.add('hidden');
  document.getElementById('pix-result').classList.remove('hidden');
  document.getElementById('pix-amount').textContent = formatBRL(resposta.valor);
  document.getElementById('pix-code-text').textContent = resposta.pixCode;

  pollHandle = setInterval(verificarPagamento, 4000);
}

document.getElementById('pix-copy').addEventListener('click', async () => {
  const codigo = document.getElementById('pix-code-text').textContent;
  try {
    await navigator.clipboard.writeText(codigo);
    showToast('Código Pix copiado', 'success');
  } catch {
    showToast('Não foi possível copiar automaticamente — selecione o código manualmente', 'error');
  }
});

async function verificarPagamento() {
  try {
    const atual = await Api.assinaturas.atual();
    if (!atual) return;

    if (atual.status === 'ativa') {
      clearInterval(pollHandle);
      document.getElementById('pix-result').classList.add('hidden');
      document.getElementById('checkout-success').classList.remove('hidden');
    } else if (atual.status === 'cancelada') {
      clearInterval(pollHandle);
      document.getElementById('pix-status').innerHTML = `${icon('xCircle', 16)} Pagamento não foi aprovado. <a href="checkout.html">Tentar novamente</a>`;
    }
  } catch {
    /* erro de rede pontual durante o polling, tenta de novo no próximo tick */
  }
}
