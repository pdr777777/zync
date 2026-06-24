Auth.requireAuth();

async function carregarHistorico() {
  const container = document.getElementById('suporte-historico');
  try {
    const itens = await Api.suporte.listar();

    if (itens.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💬</div><h3>Nenhuma mensagem enviada ainda</h3></div>';
      return;
    }

    container.innerHTML = itens.map((m) => `
      <div class="agenda-row">
        <div class="agenda-info">
          <div class="agenda-lead">${escapeHtml(m.mensagem)}</div>
          <div class="agenda-servico">
            ${formatDataHoraCurta(m.criado_em)}
            ${m.video_url ? ` · <a href="${escapeHtml(m.video_url)}" target="_blank" rel="noopener noreferrer" style="color:var(--roxo-claro);">ver vídeo</a>` : ''}
          </div>
        </div>
        <div class="agenda-actions">
          <span class="badge ${m.respondida ? 'badge-ativa' : 'badge-pendente'}">${m.respondida ? 'Respondida' : 'Aguardando resposta'}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('suporte-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const mensagem = document.getElementById('suporte-mensagem').value.trim();
  const videoUrl = document.getElementById('suporte-video').value.trim() || null;
  if (!mensagem) return;

  const btn = document.getElementById('suporte-submit');
  const label = document.getElementById('suporte-submit-label');
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span>';

  try {
    await Api.suporte.criar(mensagem, videoUrl);
    showToast('Mensagem enviada! Vamos responder em breve.', 'success');
    document.getElementById('suporte-form').reset();
    carregarHistorico();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = 'Enviar mensagem';
  }
});

carregarHistorico();
