import { createContext, useContext, useMemo, useState } from 'react';
import { authApi } from '../api/services';
import { clearSession, getStoredUser, getToken, saveSession } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));

  const login = async (username, password) => {
    const res = await authApi.login(username, password);
    const logged = {
      userId: res.userId,
      username: res.username,
      roles: res.roles || [],
      tenantId: res.tenantId || null,
      tenantName: res.tenantNombre || null,
    };
    saveSession(res.token, logged);
    setUser(logged);
    return logged;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // el token pudo haber expirado; igual cerramos la sesión local
    }
    clearSession();
    setUser(null);
  };

  // Cambia a otra empresa del mismo dueño sin re-login: reemplaza el token de sesión
  const switchEmpresa = async (tenantId) => {
    const res = await authApi.cambiarEmpresa(tenantId);
    const logged = {
      userId: res.userId,
      username: res.username,
      roles: res.roles || [],
      tenantId: res.tenantId || null,
      tenantName: res.tenantNombre || null,
    };
    saveSession(res.token, logged);
    setUser(logged);
    return logged;
  };

  const value = useMemo(() => {
    const roles = user?.roles || [];
    return {
      user,
      login,
      logout,
      switchEmpresa,
      isAuthenticated: Boolean(user),
      hasRole: (...allowed) => allowed.some((r) => roles.includes(r)),
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
