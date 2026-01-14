const API_BASE = '';

async function request(url, options = {}) {
  const config = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  // Remove Content-Type for FormData
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  const response = await fetch(`${API_BASE}${url}`, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Health check
  health: () => request('/api/health'),

  // Auth
  login: (username, password) =>
    request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),

  logout: () =>
    request('/api/admin/logout', { method: 'POST' }),

  checkAuth: () =>
    request('/api/admin/check'),

  // Config
  getConfig: () =>
    request('/api/admin/config'),

  updateConfig: (config) =>
    request('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify(config)
    }),

  // Upload
  uploadCSV: (file, slot) => {
    const formData = new FormData();
    formData.append('file', file);
    return request(`/api/admin/upload?slot=${slot}`, {
      method: 'POST',
      body: formData
    });
  },

  // Dashboard
  getDashboard: (setorId) =>
    request(`/api/dashboard?setorId=${encodeURIComponent(setorId)}`),

  // Revendedor
  getRevendedor: (setorId, codigoRevendedor) =>
    request(`/api/revendedor?setorId=${encodeURIComponent(setorId)}&codigoRevendedor=${encodeURIComponent(codigoRevendedor)}`),

  // Setores
  getSetores: () =>
    request('/api/setores')
};

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

export function formatPercent(value) {
  return `${(value || 0).toFixed(1)}%`;
}

export function getProgressColor(percent) {
  if (percent >= 80) return 'success';
  if (percent >= 50) return 'warning';
  return 'danger';
}

export function getBadgeClass(segmento) {
  const map = {
    'Iniciante': 'badge-iniciante',
    'Bronze': 'badge-bronze',
    'Prata': 'badge-prata',
    'Ouro': 'badge-ouro',
    'Platina': 'badge-platina',
    'Rubi': 'badge-rubi',
    'Esmeralda': 'badge-esmeralda',
    'Diamante': 'badge-diamante'
  };
  return map[segmento] || 'badge-iniciante';
}
