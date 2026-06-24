const PRECO_MENSAL = 197;
let ciclo = 'mensal';

function formatBRL(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function apenasDigitos(s) {
  return s.replace(/\D/g, '');
}

function mascararCartao(valor) {
  return apenasDigitos(valor).slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function mascararValidade(valor) {
  const d = apenasDigitos(valor).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

function mascararCpf(valor) {
  return apenasDigitos(valor)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/* ---------- RESUMO / CICLO DE COBRANÇA ---------- */
function atualizarResumo() {
  const subtotalLabel = document.getElementById('co-subtotal');
  const discountRow = document.getElementById('co-discount-row');
  const totalLabel = document.getElementById('co-total');
  const priceLabel = document.getElementById('co-price');
  const priceSub = document.getElementById('co-price-sub');
  const submitLabel = document.getElementById('checkout-submit-label');

  if (ciclo === 'mensal') {
    priceLabel.textContent = formatBRL(PRECO_MENSAL);
    priceSub.textContent = '/mês';
    subtotalLabel.textContent = formatBRL(PRECO_MENSAL);
    discountRow.classList.add('hidden');
    totalLabel.textContent = `${formatBRL(PRECO_MENSAL)}/mês`;
    submitLabel.textContent = `Confirmar assinatura — ${formatBRL(PRECO_MENSAL)}/mês`;
  } else {
    const subtotalAnual = PRECO_MENSAL * 12;
    const desconto = subtotalAnual * 0.2;
    const total = subtotalAnual - desconto;

    priceLabel.textContent = formatBRL(total / 12);
    priceSub.textContent = '/mês no plano anual';
    subtotalLabel.textContent = formatBRL(subtotalAnual);
    document.getElementById('co-discount').textContent = `−${formatBRL(desconto)}`;
    discountRow.classList.remove('hidden');
    totalLabel.textContent = `${formatBRL(total)}/ano`;
    submitLabel.textContent = `Confirmar assinatura — ${formatBRL(total)}/ano`;
  }
}

document.querySelectorAll('#checkout-toggle .toggle-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#checkout-toggle .toggle-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    ciclo = btn.dataset.ciclo;
    atualizarResumo();
  });
});

/* ---------- ABAS DE PAGAMENTO ---------- */
document.querySelectorAll('.method-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.method-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    document.querySelectorAll('.payment-panel').forEach((p) => p.classList.add('hidden'));
    document.getElementById(`panel-${tab.dataset.method}`).classList.remove('hidden');
  });
});

/* ---------- PREVIEW DO CARTÃO ---------- */
const cardNumero = document.getElementById('card-numero');
const cardNome = document.getElementById('card-nome');
const cardValidade = document.getElementById('card-validade');
const cardCvv = document.getElementById('card-cvv');
const cardPreview = document.getElementById('card-preview');

cardNumero.addEventListener('input', (e) => {
  e.target.value = mascararCartao(e.target.value);
  document.getElementById('cp-number').textContent = e.target.value || '•••• •••• •••• ••••';
});

cardNome.addEventListener('input', (e) => {
  document.getElementById('cp-name').textContent = e.target.value.toUpperCase() || 'NOME COMPLETO';
});

cardValidade.addEventListener('input', (e) => {
  e.target.value = mascararValidade(e.target.value);
  document.getElementById('cp-expiry').textContent = e.target.value || 'MM/AA';
});

cardCvv.addEventListener('input', (e) => {
  e.target.value = apenasDigitos(e.target.value).slice(0, 4);
  document.getElementById('cp-cvv').textContent = e.target.value || '•••';
});

cardCvv.addEventListener('focus', () => cardPreview.classList.add('flipped'));
cardCvv.addEventListener('blur', () => cardPreview.classList.remove('flipped'));

document.getElementById('co-cpf').addEventListener('input', (e) => {
  e.target.value = mascararCpf(e.target.value);
});

/* ---------- CONTA (pular se já estiver logado) ---------- */
if (Auth.isAuthenticated()) {
  document.getElementById('checkout-account-fields').classList.add('hidden');
}

/* ---------- QUERY PARAMS ---------- */
const params = new URLSearchParams(window.location.search);
if (params.get('ciclo') === 'anual') {
  document.querySelector('#checkout-toggle .toggle-btn[data-ciclo="anual"]').click();
}

/* ---------- SUBMIT ---------- */
function simularProcessamentoPagamento() {
  return new Promise((resolve) => setTimeout(resolve, 1400));
}

document.getElementById('checkout-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const btn = document.getElementById('checkout-submit');
  const label = document.getElementById('checkout-submit-label');
  const labelOriginal = label.textContent;
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span>';

  try {
    if (!Auth.isAuthenticated()) {
      const nome = document.getElementById('co-nome').value.trim();
      const email = document.getElementById('co-email').value.trim();
      const senha = document.getElementById('co-senha').value;

      if (!nome || !email || senha.length < 6) {
        throw new Error('Preencha seus dados de conta corretamente (senha com mínimo 6 caracteres).');
      }

      await Api.register(nome, email, senha);
      const { token, usuario } = await Api.login(email, senha);
      Auth.setSession(token, usuario);
    }

    await simularProcessamentoPagamento();

    document.getElementById('checkout-active').classList.add('hidden');
    document.getElementById('checkout-success').classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    label.textContent = labelOriginal;
  }
});

atualizarResumo();
