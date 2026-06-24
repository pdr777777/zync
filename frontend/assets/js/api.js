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
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
    }
  },
  redirectIfAuthenticated() {
    if (this.isAuthenticated()) {
      window.location.href = 'dashboard.html';
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

  dashboard: () => apiRequest('/dashboard'),

  leads: {
    listar: () => apiRequest('/leads'),
    buscar: (id) => apiRequest(`/leads/${id}`),
    criar: (dados) => apiRequest('/leads', { method: 'POST', body: dados }),
    atualizar: (id, dados) => apiRequest(`/leads/${id}`, { method: 'PUT', body: dados }),
    remover: (id) => apiRequest(`/leads/${id}`, { method: 'DELETE' }),
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
};

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
