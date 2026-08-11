import { z } from 'zod';
import {
  AuthResponseSchema,
  type ChangeEmailRequest,
  type ChangePasswordRequest,
  ConsentSchema,
  ConsentStatusSchema,
  type CreateReportRequest,
  type GrantConsentRequest,
  type LoginRequest,
  MatchScoreExplanationSchema,
  type ModerationActionRequest,
  ProfileSchema,
  type RankingListQuery,
  RankingListResponseSchema,
  RankingMeResponseSchema,
  type RegisterRequest,
  ReportDetailSchema,
  ReportListResponseSchema,
  type ReportListQuery,
  ReportSchema,
  UserDataExportSchema,
  UserSchema,
  type UpdateProfileRequest,
  AntiCheatSessionSecretResponseSchema,
  LivekitTokenResponseSchema,
} from '@aurafarming/shared';

import { getApiUrl } from './env';

const SuccessSchema = z.object({ success: z.literal(true) });

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

type RefreshHandler = () => Promise<string | null>;
let refreshHandler: RefreshHandler | null = null;

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
    this.name = 'ApiError';
  }
}

type ZodParseable<T> = { parse: (value: unknown) => T };

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;

  auth?: boolean;

  credentials?: RequestCredentials;
};

async function request<T>(
  path: string,
  schema: ZodParseable<T>,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const { method = 'GET', body, auth = true, credentials = 'omit' } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
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
    throw new ApiError(response.status, raw, 'Resposta da API não bate com o contrato esperado');
  }
}

async function requestMultipart<T>(
  path: string,
  schema: ZodParseable<T>,
  formData: FormData,
  isRetry = false,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${getApiUrl()}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (response.status === 401 && !isRetry && refreshHandler) {
    const newToken = await refreshHandler();
    if (newToken) {
      return requestMultipart(path, schema, formData, true);
    }
  }

  const raw = response.status === 204 ? undefined : await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new ApiError(response.status, raw);
  }

  try {
    return schema.parse(raw);
  } catch {
    throw new ApiError(response.status, raw, 'Resposta da API não bate com o contrato esperado');
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
  register: (body: RegisterRequest) =>
    request('/auth/register', UserSchema, { method: 'POST', body, auth: false }),
  login: (body: LoginRequest) =>
    request('/auth/login', AuthResponseSchema, {
      method: 'POST',
      body,
      auth: false,
      credentials: 'include',
    }),
  refresh: () =>
    request('/auth/refresh', AuthResponseSchema, {
      method: 'POST',
      auth: false,
      credentials: 'include',
    }),
  logout: () => request('/auth/logout', SuccessSchema, { method: 'POST', credentials: 'include' }),
  me: () => request('/auth/me', UserSchema),
};

export const usersApi = {
  getProfile: () => request('/users/me/profile', ProfileSchema),
  updateProfile: (body: UpdateProfileRequest) =>
    request('/users/me/profile', ProfileSchema, { method: 'PATCH', body }),
  exportData: () => request('/users/me/export', UserDataExportSchema),
  deleteAccount: () => request('/users/me', SuccessSchema, { method: 'DELETE' }),
  grantConsent: (body: GrantConsentRequest) =>
    request('/users/me/consents', ConsentSchema, { method: 'POST', body }),
  listConsents: () => request('/users/me/consents', z.array(ConsentSchema)),
  consentStatus: () => request('/users/me/consents/status', z.array(ConsentStatusSchema)),
  changePassword: (body: ChangePasswordRequest) =>
    request('/users/me/password', AuthResponseSchema, {
      method: 'PATCH',
      body,
      credentials: 'include',
    }),
  changeEmail: (body: ChangeEmailRequest) =>
    request('/users/me/email', AuthResponseSchema, {
      method: 'PATCH',
      body,
      credentials: 'include',
    }),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestMultipart('/users/me/avatar', ProfileSchema, formData);
  },
};

export const matchesApi = {
  getLivekitToken: (matchId: string) =>
    request(`/matches/${matchId}/token`, LivekitTokenResponseSchema, { method: 'POST' }),
  getAntiCheatSecret: (matchId: string) =>
    request(`/matches/${matchId}/anti-cheat-secret`, AntiCheatSessionSecretResponseSchema, {
      method: 'POST',
    }),
  getScoreExplanation: (matchId: string) =>
    request(`/matches/${matchId}/score-explanation`, MatchScoreExplanationSchema),
};

export const rankingApi = {
  list: (query: RankingListQuery) =>
    request(`/ranking?${toQueryString(query)}`, RankingListResponseSchema),
  me: () => request('/ranking/me', RankingMeResponseSchema),
};

export const reportsApi = {
  create: (body: CreateReportRequest) =>
    request('/reports', ReportSchema, { method: 'POST', body }),
};

export const moderationApi = {
  listReports: (query: ReportListQuery) =>
    request(
      `/moderation/reports?${toQueryString({ status: query.status, limit: query.limit, offset: query.offset })}`,
      ReportListResponseSchema,
    ),
  getReport: (id: string) => request(`/moderation/reports/${id}`, ReportDetailSchema),
  resolveReport: (id: string, body: ModerationActionRequest) =>
    request(`/moderation/reports/${id}/action`, ReportSchema, { method: 'POST', body }),
};
