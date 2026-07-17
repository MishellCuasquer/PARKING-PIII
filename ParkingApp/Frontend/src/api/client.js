const TOKEN_KEY = 'parking_token';
const USER_KEY = 'parking_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Wrapper de fetch: adjunta el JWT y normaliza errores de Spring y NestJS.
export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    let message = `Error ${res.status}`;
    if (data && typeof data === 'object') {
      const raw = data.message || data.error || data.detail;
      if (Array.isArray(raw)) message = raw.join('. ');
      else if (raw) message = raw;
    } else if (typeof data === 'string' && data) {
      message = data;
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return data;
}
