const API_BASE = (() => {
  const { hostname, protocol } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3001/api`;
  }
  return 'https://zync-backend-production.up.railway.app/api';
})();

const Auth = {
  getToken() {
    return localStorage.getItem('zync_token');
  },
  getUsuario() {
    const raw = localStorage.getItem('zync_usuario');
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, usuario) {
    localStorage.setItem('zync_token', token);
    localStorage.setItem('zync_usuario', JSON.stringify(usuario));
  },
  clearSession() {
    localStorage.removeItem('zync_token');
    localStorage.removeItem('zync_usuario');
  },
  isAuthenticated() {
    return !!this.getToken();
  },
  isAdmin() {
    const usuario = this.getUsuario();
    return !!usuario && !!usuario.is_admin;
  },
  destinoPosLogin() {
    return this.isAdmin() ? 'admin.html' : 'dashboard.html';
  },
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
    }
  },
  redirectIfAuthenticated() {
    if (this.isAuthenticated()) {
      window.location.href = this.destinoPosLogin();
    }
  },
  logout() {
    this.clearSession();
    window.location.href = 'login.html';
  },
};

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = Auth.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique se o backend está rodando.', 0);
  }

  if (res.status === 401 && auth) {
    Auth.clearSession();
    window.location.href = 'login.html';
    throw new ApiError('Sessão expirada', 401);
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || 'Ocorreu um erro inesperado', res.status);
  }

  return data;
}

const Api = {
  register: (nome, email, senha) => apiRequest('/auth/register', { method: 'POST', body: { nome, email, senha }, auth: false }),
  login: (email, senha) => apiRequest('/auth/login', { method: 'POST', body: { email, senha }, auth: false }),

  auth: {
    me: () => apiRequest('/auth/me'),
    atualizarMe: (dados) => apiRequest('/auth/me', { method: 'PUT', body: dados }),
    esqueciSenha: (email) => apiRequest('/auth/esqueci-senha', { method: 'POST', body: { email }, auth: false }),
    redefinirSenha: (token, novaSenha) => apiRequest('/auth/redefinir-senha', { method: 'POST', body: { token, novaSenha }, auth: false }),
  },

  admin: {
    metricas: () => apiRequest('/admin/metricas'),
    usuarios: () => apiRequest('/admin/usuarios'),
    definirAdmin: (id, isAdmin) => apiRequest(`/admin/usuarios/${id}/admin`, { method: 'PATCH', body: { isAdmin } }),
    planos: {
      listar: () => apiRequest('/admin/planos'),
      criar: (dados) => apiRequest('/admin/planos', { method: 'POST', body: dados }),
      atualizar: (id, dados) => apiRequest(`/admin/planos/${id}`, { method: 'PUT', body: dados }),
    },
    suporte: {
      listar: () => apiRequest('/admin/suporte'),
      marcarRespondida: (id) => apiRequest(`/admin/suporte/${id}/respondida`, { method: 'PATCH' }),
    },
  },

  dashboard: () => apiRequest('/dashboard'),

  relatorios: {
    leadsPorOrigem: () => apiRequest('/relatorios/leads-por-origem'),
    funilConversao: () => apiRequest('/relatorios/funil-conversao'),
    faturamento: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiRequest(`/relatorios/faturamento${qs ? `?${qs}` : ''}`);
    },
  },

  notificacoes: {
    listar: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiRequest(`/notificacoes${qs ? `?${qs}` : ''}`);
    },
    contagem: () => apiRequest('/notificacoes/contagem'),
    marcarLida: (id) => apiRequest(`/notificacoes/${id}/lida`, { method: 'PATCH' }),
    marcarTodasLidas: () => apiRequest('/notificacoes/lida-todas', { method: 'PATCH' }),
  },

  suporte: {
    listar: () => apiRequest('/suporte'),
    criar: (mensagem, videoUrl) => apiRequest('/suporte', { method: 'POST', body: { mensagem, videoUrl } }),
  },

  leads: {
    listar: (tagId) => apiRequest(tagId ? `/leads?tagId=${encodeURIComponent(tagId)}` : '/leads'),
    buscar: (id) => apiRequest(`/leads/${id}`),
    criar: (dados) => apiRequest('/leads', { method: 'POST', body: dados }),
    atualizar: (id, dados) => apiRequest(`/leads/${id}`, { method: 'PUT', body: dados }),
    remover: (id) => apiRequest(`/leads/${id}`, { method: 'DELETE' }),
  },

  tags: {
    listar: () => apiRequest('/tags'),
    criar: (nome) => apiRequest('/tags', { method: 'POST', body: { nome } }),
    remover: (id) => apiRequest(`/tags/${id}`, { method: 'DELETE' }),
    doLead: (leadId) => apiRequest(`/leads/${leadId}/tags`),
    associar: (leadId, tagId) => apiRequest(`/leads/${leadId}/tags`, { method: 'POST', body: { tagId } }),
    desassociar: (leadId, tagId) => apiRequest(`/leads/${leadId}/tags/${tagId}`, { method: 'DELETE' }),
  },

  camposPersonalizados: {
    listar: () => apiRequest('/campos-personalizados'),
    criar: (dados) => apiRequest('/campos-personalizados', { method: 'POST', body: dados }),
    atualizar: (id, dados) => apiRequest(`/campos-personalizados/${id}`, { method: 'PATCH', body: dados }),
    remover: (id) => apiRequest(`/campos-personalizados/${id}`, { method: 'DELETE' }),
    doLead: (leadId) => apiRequest(`/leads/${leadId}/campos-personalizados`),
    definir: (leadId, campoId, valor) => apiRequest(`/leads/${leadId}/campos-personalizados/${campoId}`, { method: 'PUT', body: { valor } }),
    removerValor: (leadId, campoId) => apiRequest(`/leads/${leadId}/campos-personalizados/${campoId}`, { method: 'DELETE' }),
  },

  agendamentos: {
    listarTodos: () => apiRequest('/agendamentos'),
    doLead: (leadId) => apiRequest(`/leads/${leadId}/agendamentos`),
    criar: (leadId, dados) => apiRequest(`/leads/${leadId}/agendamentos`, { method: 'POST', body: dados }),
    atualizar: (id, dados) => apiRequest(`/agendamentos/${id}`, { method: 'PUT', body: dados }),
    remover: (id) => apiRequest(`/agendamentos/${id}`, { method: 'DELETE' }),
  },

  mensagens: {
    listar: (leadId) => apiRequest(`/leads/${leadId}/mensagens`),
    criar: (leadId, conteudo, enviado_por) => apiRequest(`/leads/${leadId}/mensagens`, { method: 'POST', body: { conteudo, enviado_por } }),
  },

  whatsapp: {
    enviar: (leadId, conteudo) => apiRequest(`/leads/${leadId}/whatsapp/enviar`, { method: 'POST', body: { conteudo } }),
  },

  ia: {
    simular: (leadId, conteudo) => apiRequest(`/leads/${leadId}/ia/responder`, { method: 'POST', body: { conteudo } }),
  },

  planos: {
    listar: () => apiRequest('/planos'),
  },

  assinaturas: {
    checkout: (dados) => apiRequest('/assinaturas/checkout', { method: 'POST', body: dados }),
    atual: () => apiRequest('/assinaturas/atual'),
  },

  integracoes: {
    listar: () => apiRequest('/integracoes'),
    criar: (dados) => apiRequest('/integracoes', { method: 'POST', body: dados }),
    atualizar: (id, dados) => apiRequest(`/integracoes/${id}`, { method: 'PATCH', body: dados }),
    remover: (id) => apiRequest(`/integracoes/${id}`, { method: 'DELETE' }),
    testar: (id) => apiRequest(`/integracoes/${id}/testar`, { method: 'POST' }),
  },

  catalogo: {
    listar: () => apiRequest('/catalogo'),
    criar: (dados) => apiRequest('/catalogo', { method: 'POST', body: dados }),
    atualizar: (id, dados) => apiRequest(`/catalogo/${id}`, { method: 'PATCH', body: dados }),
    remover: (id) => apiRequest(`/catalogo/${id}`, { method: 'DELETE' }),
    link: () => apiRequest('/catalogo/link'),
  },

  catalogoPublico: {
    obter: (slug) => apiRequest(`/catalogo-publico/${slug}`, { auth: false }),
    solicitar: (slug, dados) => apiRequest(`/catalogo-publico/${slug}/solicitar`, { method: 'POST', body: dados, auth: false }),
  },
};

async function downloadComAuth(path, filename) {
  const token = Auth.getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || 'Erro ao exportar', res.status);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function showToast(message, type = 'success') {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.25s';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}
