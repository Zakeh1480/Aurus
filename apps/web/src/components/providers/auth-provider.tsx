"use client";

import * as React from "react";
import type { LoginRequest, RegisterRequest, User } from "@aurafarming/shared";

import { authApi, setAccessToken } from "@/lib/api-client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  accessToken: string | null;
  login: (body: LoginRequest) => Promise<void>;
  register: (body: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [token, setToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    authApi
      .refresh()
      .then((response) => {
        if (cancelled) return;
        setAccessToken(response.tokens.accessToken);
        setToken(response.tokens.accessToken);
        setUser(response.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setAccessToken(null);
        setUser(null);
        setStatus("unauthenticated");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = React.useCallback(async (body: LoginRequest) => {
    const response = await authApi.login(body);
    setAccessToken(response.tokens.accessToken);
    setToken(response.tokens.accessToken);
    setUser(response.user);
    setStatus("authenticated");
  }, []);

  // POST /auth/register só cria a conta (retorna User, sem tokens/cookie) — o
  // login em seguida é responsabilidade de quem chama (Prompt 9: fluxo de UI).
  const register = React.useCallback(async (body: RegisterRequest) => {
    await authApi.register(body);
  }, []);

  const logout = React.useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    setAccessToken(null);
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, status, accessToken: token, login, register, logout }),
    [user, status, token, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  }
  return ctx;
}
