// Cliente HTTP minimo sobre fetch para la API de auth.
// La base viene de VITE_API_URL (build-time). Ver .env.example.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

// Hace un POST JSON y devuelve el body parseado. Si el backend responde con
// error, lanza un Error con el mensaje del backend ({ error: "..." }).
async function postJson(path, body) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Fallo de red / CORS / server caido: fetch no resuelve a una respuesta.
    throw new Error('No se pudo conectar con el servidor.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error inesperado del servidor.');
  }
  return data;
}

export function register({ username, email, password }) {
  return postJson('/api/auth/register', { username, email, password });
}

export function login({ email, password }) {
  return postJson('/api/auth/login', { email, password });
}

export function verifyEmail({ token }) {
  return postJson('/api/auth/verify-email', { token });
}

export function requestPasswordReset({ email }) {
  return postJson('/api/auth/request-password-reset', { email });
}

export function resetPassword({ token, password }) {
  return postJson('/api/auth/reset-password', { token, password });
}

// Fetch autenticado generico (JSON). Igual que postJson pero con Authorization
// y soporte de metodo/GET.
async function authFetch(path, { method = 'GET', token, body } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Error inesperado del servidor.');
    err.retryAfter = data.retryAfter;
    throw err;
  }
  return data;
}

export function resendVerification({ token }) {
  return authFetch('/api/auth/resend-verification', { method: 'POST', token });
}

export function updateProfile({ token, ...fields }) {
  return authFetch('/api/users/me', { method: 'PATCH', token, body: fields });
}

export function getUserProfile({ token, userId }) {
  return authFetch(`/api/users/${userId}`, { token });
}

// Sube la foto de avatar (multipart). Necesita el JWT. Devuelve { user }.
export async function uploadAvatar({ token, file }) {
  const body = new FormData();
  body.append('avatar', file);
  let res;
  try {
    res = await fetch(`${API_URL}/api/users/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body, // sin Content-Type: el navegador pone el boundary del multipart
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo subir la imagen.');
  return data;
}
