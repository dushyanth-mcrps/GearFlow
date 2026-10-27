const API_BASE = '/api';

export async function apiRequest(endpoint, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const authToken = token || localStorage.getItem('gearflow_token');
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const authApi = {
  login: (email, password) => apiRequest('/auth/login', { method: 'POST', body: { email, password } }),
  register: (payload) => apiRequest('/auth/register', { method: 'POST', body: payload }),
  getProfile: () => apiRequest('/auth/me'),
  getUsers: () => apiRequest('/auth/users')
};

export const assetsApi = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/assets${q ? `?${q}` : ''}`);
  },
  getById: (id) => apiRequest(`/assets/${id}`),
  checkAvailability: (id, startTime, endTime) => {
    return apiRequest(`/assets/${id}/availability?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`);
  },
  create: (asset) => apiRequest('/assets', { method: 'POST', body: asset }),
  update: (id, updates) => apiRequest(`/assets/${id}`, { method: 'PUT', body: updates }),
  getCategories: () => apiRequest('/assets/categories')
};

export const reservationsApi = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/reservations${q ? `?${q}` : ''}`);
  },
  getById: (id) => apiRequest(`/reservations/${id}`),
  create: (payload) => apiRequest('/reservations', { method: 'POST', body: payload }),
  cancel: (id) => apiRequest(`/reservations/${id}/cancel`, { method: 'PUT' }),
  checkout: (id, payload) => apiRequest(`/reservations/${id}/checkout`, { method: 'POST', body: payload }),
  returnGear: (id, payload) => apiRequest(`/reservations/${id}/return`, { method: 'POST', body: payload }),
  settlePenalty: (id, action) => apiRequest(`/reservations/${id}/penalty/settle`, { method: 'POST', body: { action } })
};

export const maintenanceApi = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/maintenance${q ? `?${q}` : ''}`);
  },
  getById: (id) => apiRequest(`/maintenance/${id}`),
  create: (payload) => apiRequest('/maintenance', { method: 'POST', body: payload }),
  update: (id, updates) => apiRequest(`/maintenance/${id}`, { method: 'PUT', body: updates })
};

export const statsApi = {
  getDashboard: () => apiRequest('/stats/dashboard'),
  getAuditLogs: (limit = 40) => apiRequest(`/stats/audit-logs?limit=${limit}`)
};
