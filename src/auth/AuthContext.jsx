import { useState, useCallback } from 'react';
import * as api from '../lib/api.js';
import { AuthContext } from './context.js';

// Persistimos la sesion (token + user) en localStorage para sobrevivir
// recargas. ponytail: localStorage es vulnerable a XSS; suficiente para este
// proyecto academico. Upgrade real: cookie httpOnly emitida por el backend.
const STORAGE_KEY = 'chat.session';

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);

  const persist = useCallback((data) => {
    // data = { token, user }. La respuesta del server es un limite de
    // confianza: si no trae token, no guardamos una sesion a medias.
    if (!data?.token) throw new Error('Respuesta de autenticacion invalida.');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSession(data);
  }, []);

  const signIn = useCallback(
    async (credentials) => persist(await api.login(credentials)),
    [persist],
  );

  const signUp = useCallback(
    async (data) => persist(await api.register(data)),
    [persist],
  );

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const value = {
    user: session?.user ?? null,
    token: session?.token ?? null,
    isAuthenticated: Boolean(session?.token),
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
