"use client";

import * as React from "react";
import type { AuthResponse, LoginRequest, RegisterRequest, User } from "@aurafarming/shared";

import { authApi, setAccessToken, setRefreshHandler } from "@/lib/api-client";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  accessToken: string | null;
  login: (body: LoginRequest) => Promise<void>;
  register: (body: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

/** Refresca ~60s antes do vencimento do access token; piso de 5s contra TTLs artificialmente baixos. */
function msUntilNextRefresh(expiresInSeconds: number): number {
  return Math.max((expiresInSeconds - 60) * 1000, 5_000);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [token, setToken] = React.useState<string | null>(null);

  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInFlightRef = React.useRef<Promise<string | null> | null>(null);

  const clearScheduledRefresh = React.useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const scheduleRefresh = React.useCallback(
    (expiresInSeconds: number) => {
      clearScheduledRefresh();
      refreshTimerRef.current = setTimeout(() => {
        void performRefreshRef.current();
      }, msUntilNextRefresh(expiresInSeconds));
    },
    [clearScheduledRefresh],
  );

  const applyAuthResponse = React.useCallback(
    (response: AuthResponse) => {
      setAccessToken(response.tokens.accessToken);
      setToken(response.tokens.accessToken);
      setUser(response.user);
      setStatus("authenticated");
      scheduleRefresh(response.tokens.expiresIn);
    },
    [scheduleRefresh],
  );

  // Deduplicado: chamadas concorrentes (mount + timer proativo + retentativa reativa
  // de um 401) reaproveitam a mesma promise em voo, evitando N refreshes simultâneos
  // — o backend revoga TODAS as sessões ao detectar reuso de um refresh token já
  // rotacionado, então múltiplas chamadas /auth/refresh em paralelo seriam destrutivas.
  const performRefresh = React.useCallback(async (): Promise<string | null> => {
    if (refreshInFlightRef.current !== null) {
      return refreshInFlightRef.current;
    }

    const inFlight = authApi
      .refresh()
      .then((response) => {
        applyAuthResponse(response);
        return response.tokens.accessToken;
      })
      .catch(() => {
        clearScheduledRefresh();
        setAccessToken(null);
        setToken(null);
        setUser(null);
        setStatus("unauthenticated");
        return null;
      })
      .finally(() => {
        refreshInFlightRef.current = null;
      });

    refreshInFlightRef.current = inFlight;
    return inFlight;
  }, [applyAuthResponse, clearScheduledRefresh]);

  // `scheduleRefresh` é definido antes de `performRefresh` (para não reordenar as
  // declarações acima), mas precisa chamar a versão mais recente de `performRefresh`
  // — um ref evita um ciclo de dependências entre os dois `useCallback`s.
  const performRefreshRef = React.useRef(performRefresh);
  React.useEffect(() => {
    performRefreshRef.current = performRefresh;
  }, [performRefresh]);

  React.useEffect(() => {
    setRefreshHandler(performRefresh);
    return () => setRefreshHandler(null);
  }, [performRefresh]);

  // Deps vazias intencionalmente: só na montagem, restaura a sessão via cookie
  // httpOnly. `performRefresh` já é estável o bastante via `useCallback`.
  React.useEffect(() => {
    void performRefresh();
    return () => clearScheduledRefresh();
  }, []);

  const login = React.useCallback(
    async (body: LoginRequest) => {
      const response = await authApi.login(body);
      applyAuthResponse(response);
    },
    [applyAuthResponse],
  );

  // POST /auth/register só cria a conta (retorna User, sem tokens/cookie) — o
  // login em seguida é responsabilidade de quem chama (Prompt 9: fluxo de UI).
  const register = React.useCallback(async (body: RegisterRequest) => {
    await authApi.register(body);
  }, []);

  const logout = React.useCallback(async () => {
    clearScheduledRefresh();
    await authApi.logout().catch(() => undefined);
    setAccessToken(null);
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, [clearScheduledRefresh]);

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
