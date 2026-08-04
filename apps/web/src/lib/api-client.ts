import { z } from "zod";
import {
  AuthResponseSchema,
  ConsentSchema,
  ConsentStatusSchema,
  type GrantConsentRequest,
  type LoginRequest,
  ProfileSchema,
  type RankingListQuery,
  RankingListResponseSchema,
  type RegisterRequest,
  UserDataExportSchema,
  UserSchema,
  type UpdateProfileRequest,
  AntiCheatSessionSecretResponseSchema,
  LivekitTokenResponseSchema,
} from "@aurafarming/shared";

import { getApiUrl } from "./env";

/** `{ success: true }` é um retorno inline dos controllers Nest, não um DTO de `shared`. */
const SuccessSchema = z.object({ success: z.literal(true) });

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Chamado no 401 de uma requisição autenticada; retorna o novo access token ou `null` se o refresh falhou. */
type RefreshHandler = () => Promise<string | null>;
let refreshHandler: RefreshHandler | null = null;

/** Registrado pelo `AuthProvider` — mantém `api-client.ts` livre de import de React. */
export function setRefreshHandler(handler: RefreshHandler | null): void {
  refreshHandler = handler;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `Erro de API (status ${status})`);
    this.name = "ApiError";
  }
}

type ZodParseable<T> = { parse: (value: unknown) => T };

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Anexa `Authorization: Bearer` com o access token em memória. Default: true. */
  auth?: boolean;
  /** Necessário só nas rotas que leem/escrevem o cookie httpOnly `refresh_token`. Default: "omit". */
  credentials?: RequestCredentials;
};

async function request<T>(
  path: string,
  schema: ZodParseable<T>,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const { method = "GET", body, auth = true, credentials = "omit" } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${getApiUrl()}${path}`, {
    method,
    headers,
    credentials,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Uma retentativa silenciosa via refresh — nunca para chamadas `auth: false`
  // (login/register/refresh já não anexam o token) nem para a própria retentativa,
  // o que garante no máximo uma chamada extra por requisição, sem loop.
  if (response.status === 401 && auth && !isRetry && refreshHandler) {
    const newToken = await refreshHandler();
    if (newToken) {
      return request(path, schema, options, true);
    }
  }

  const raw = response.status === 204 ? undefined : await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new ApiError(response.status, raw);
  }

  try {
    return schema.parse(raw);
  } catch {
    throw new ApiError(response.status, raw, "Resposta da API não bate com o contrato esperado");
  }
}

function toQueryString(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

export const authApi = {
  register: (body: RegisterRequest) => request("/auth/register", UserSchema, { method: "POST", body, auth: false }),
  login: (body: LoginRequest) =>
    request("/auth/login", AuthResponseSchema, { method: "POST", body, auth: false, credentials: "include" }),
  refresh: () => request("/auth/refresh", AuthResponseSchema, { method: "POST", auth: false, credentials: "include" }),
  logout: () => request("/auth/logout", SuccessSchema, { method: "POST", credentials: "include" }),
  me: () => request("/auth/me", UserSchema),
};

export const usersApi = {
  getProfile: () => request("/users/me/profile", ProfileSchema),
  updateProfile: (body: UpdateProfileRequest) =>
    request("/users/me/profile", ProfileSchema, { method: "PATCH", body }),
  exportData: () => request("/users/me/export", UserDataExportSchema),
  deleteAccount: () => request("/users/me", SuccessSchema, { method: "DELETE" }),
  grantConsent: (body: GrantConsentRequest) => request("/users/me/consents", ConsentSchema, { method: "POST", body }),
  listConsents: () => request("/users/me/consents", z.array(ConsentSchema)),
  consentStatus: () => request("/users/me/consents/status", z.array(ConsentStatusSchema)),
};

export const matchesApi = {
  getLivekitToken: (matchId: string) =>
    request(`/matches/${matchId}/token`, LivekitTokenResponseSchema, { method: "POST" }),
  getAntiCheatSecret: (matchId: string) =>
    request(`/matches/${matchId}/anti-cheat-secret`, AntiCheatSessionSecretResponseSchema, { method: "POST" }),
};

export const rankingApi = {
  list: (query: RankingListQuery) =>
    request(`/ranking?${toQueryString(query)}`, RankingListResponseSchema),
};
