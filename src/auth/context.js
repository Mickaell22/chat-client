import { createContext, useContext } from 'react';

// Context y hook viven aparte del Provider para no mezclar exports de
// componentes con no-componentes (lo exige react-refresh / fast refresh).
export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
