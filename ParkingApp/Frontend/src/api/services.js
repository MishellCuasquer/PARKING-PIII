import { api } from './client';

// ---- ms-usuarios-roles-auth (via Kong /api/...) ----
export const authApi = {
  login: (username, password) =>
    api('/api/auth/login', { method: 'POST', body: { username, password }, auth: false }),
  logout: () => api('/api/auth/logout', { method: 'POST' }),
};

export const usersApi = {
  list: () => api('/api/users'),
  create: (data) => api('/api/users', { method: 'POST', body: data }),
  // Registro público: mismo endpoint pero sin token (el backend decide si lo permite)
  register: (data) => api('/api/users', { method: 'POST', body: data, auth: false }),
  assignRole: (userId, roleId) =>
    api(`/api/users/${userId}/roles/${roleId}`, { method: 'POST' }),
  remove: (userId) => api(`/api/users/${userId}`, { method: 'DELETE' }),
};

export const rolesApi = {
  list: () => api('/api/roles'),
  create: (data) => api('/api/roles', { method: 'POST', body: data }),
};

export const personasApi = {
  list: () => api('/api/personas'),
  byDni: (dni) => api(`/api/personas/${dni}`),
};

// ---- ms-zonas-espacios (via Kong /api/...) ----
export const zonasApi = {
  list: () => api('/api/zonas', { auth: false }),
  create: (data) => api('/api/zonas', { method: 'POST', body: data }),
  update: (id, data) => api(`/api/zonas/${id}`, { method: 'PUT', body: data }),
  remove: (id) => api(`/api/zonas/${id}`, { method: 'DELETE' }),
  initEspacios: (id) => api(`/api/zonas/${id}/init-espacios`, { method: 'POST' }),
};

export const espaciosApi = {
  list: () => api('/api/espacios', { auth: false }),
  create: (data) => api('/api/espacios', { method: 'POST', body: data }),
  remove: (id) => api(`/api/espacios/${id}`, { method: 'DELETE' }),
  // El backend espera el estado como query param (@RequestParam)
  cambiarEstado: (id, estado) =>
    api(`/api/espacios/${id}/estado?estado=${estado}`, { method: 'PUT' }),
  reservar: (id) => api(`/api/espacios/${id}/reservar`, { method: 'PUT' }),
};

// ---- ms-vehiculos (via Kong /vehiculos; el proxy quita el prefijo /gw) ----
export const vehiculosApi = {
  list: () => api('/gw/vehiculos'),
  byPlaca: (placa) => api(`/gw/vehiculos/placa/${placa}`),
  create: (data) => api('/gw/vehiculos', { method: 'POST', body: data }),
  update: (id, data) => api(`/gw/vehiculos/${id}`, { method: 'PATCH', body: data }),
  remove: (id) => api(`/gw/vehiculos/${id}`, { method: 'DELETE' }),
};

// ---- ms-audit (via Kong /api/audit) ----
export const auditApi = {
  list: () => api('/api/audit'),
};

// ---- ms-tickets (via Kong /tickets; el proxy quita el prefijo /gw) ----
export const ticketsApi = {
  list: () => api('/gw/tickets'),
  activos: () => api('/gw/tickets/activos'),
  create: (data) => api('/gw/tickets', { method: 'POST', body: data }),
  cerrar: (id) => api(`/gw/tickets/${id}/cerrar`, { method: 'PATCH', body: {} }),
  remove: (id) => api(`/gw/tickets/${id}`, { method: 'DELETE' }),
};
