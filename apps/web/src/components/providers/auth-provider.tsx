'use client';

import * as React from 'react';
import type { LoginRequest, RegisterRequest, SessionUserResponse, User } from '@aurafarming/shared';

import { authApi, setSessionExpiredHandler } from '@/lib/api-client';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  login: (body: LoginRequest) => Promise<void>;
  register: (body: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;

  applySession: (response: SessionUserResponse) => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>('loading');

  const applySession = React.useCallback((response: SessionUserResponse) => {
    setUser(response.user);
    setStatus('authenticated');
  }, []);

  const markUnauthenticated = React.useCallback(() => {
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  React.useEffect(() => {
    setSessionExpiredHandler(markUnauthenticated);
    return () => setSessionExpiredHandler(null);
  }, [markUnauthenticated]);

  React.useEffect(() => {
    let cancelled = false;

    authApi
      .session()
      .then((result) => {
        if (cancelled) return;
        if (result.status === 'authenticated') {
          setUser(result.user);
          setStatus('authenticated');
        } else {
          markUnauthenticated();
        }
      })
      .catch(() => {
        if (!cancelled) markUnauthenticated();
      });

    return () => {
      cancelled = true;
    };
  }, [markUnauthenticated]);

  const login = React.useCallback(
    async (body: LoginRequest) => {
      const response = await authApi.login(body);
      applySession(response);
    },
    [applySession],
  );

  const register = React.useCallback(async (body: RegisterRequest) => {
    await authApi.register(body);
  }, []);

  const logout = React.useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    markUnauthenticated();
  }, [markUnauthenticated]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login,
      register,
      logout,
      applySession,
    }),
    [user, status, login, register, logout, applySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  }
  return ctx;
}
