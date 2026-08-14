import { z } from 'zod';
import {
  type ChangeEmailRequest,
  type ChangePasswordRequest,
  ConsentSchema,
  ConsentStatusSchema,
  type CreateReportRequest,
  BffSessionStatusResponseSchema,
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
  SessionUserResponseSchema,
  UserDataExportSchema,
  UserSchema,
  type UpdateProfileRequest,
  AntiCheatSessionSecretResponseSchema,
  LivekitTokenResponseSchema,
  WsTicketResponseSchema,
} from '@aurafarming/shared';

const SuccessSchema = z.object({ success: z.literal(true) });

type SessionExpiredHandler = () => void;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  sessionExpiredHandler = handler;
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
};

async function request<T>(
  path: string,
  schema: ZodParseable<T>,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`/api/bff${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && auth) {
    sessionExpiredHandler?.();
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
): Promise<T> {
  const response = await fetch(`/api/bff${path}`, {
    method: 'POST',
    body: formData,
  });

  if (response.status === 401) {
    sessionExpiredHandler?.();
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
    request('/auth/login', SessionUserResponseSchema, { method: 'POST', body, auth: false }),
  logout: () => request('/auth/logout', SuccessSchema, { method: 'POST' }),
  session: () => request('/auth/session', BffSessionStatusResponseSchema, { auth: false }),
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
    request('/users/me/password', SessionUserResponseSchema, { method: 'PATCH', body }),
  changeEmail: (body: ChangeEmailRequest) =>
    request('/users/me/email', SessionUserResponseSchema, { method: 'PATCH', body }),
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

export const wsApi = {
  getTicket: () => request('/ws-ticket', WsTicketResponseSchema, { method: 'POST' }),
};
