import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, authApi, setSessionExpiredHandler, usersApi } from '../../src/lib/api-client.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const validUser = {
  id: '8f14e45f-ceea-467e-adc6-11a75d3f8e1a',
  email: 'jogador@example.com',
  displayName: 'jogador',
  avatarUrl: null,
  role: 'user',
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
};

const validSessionUserResponse = { user: validUser };

const validProfile = {
  userId: '8f14e45f-ceea-467e-adc6-11a75d3f8e1a',
  nickname: 'jogador',
  avatarUrl: null,
  bio: null,
  rating: 1000,
  auraScoreAvg: null,
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
};

describe('apiClient', () => {
  beforeEach(() => {
    setSessionExpiredHandler(null);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('chama o BFF same-origin (/api/bff/*), nunca a API externa diretamente', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, validProfile));

    await usersApi.getProfile();

    const [url] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('/api/bff/users/me/profile');
  });

  it('nunca anexa um header Authorization (o BFF resolve o token server-side)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, validProfile));

    await usersApi.getProfile();

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('lança ApiError em resposta não-2xx', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(401, { message: 'unauthorized' }));

    await expect(usersApi.getProfile()).rejects.toBeInstanceOf(ApiError);
  });

  it('lança ApiError quando a resposta não bate com o schema de shared', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { nonsense: true }));

    await expect(usersApi.getProfile()).rejects.toBeInstanceOf(ApiError);
  });

  describe('sessão expirada', () => {
    it('aciona o handler de sessão expirada num 401 de uma rota autenticada', async () => {
      const handler = vi.fn();
      setSessionExpiredHandler(handler);
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(401, { message: 'unauthorized' }));

      await expect(usersApi.getProfile()).rejects.toBeInstanceOf(ApiError);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('não aciona o handler em chamadas auth:false (ex.: login com credenciais erradas)', async () => {
      const handler = vi.fn();
      setSessionExpiredHandler(handler);
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(401, { message: 'unauthorized' }));

      await expect(
        authApi.login({ email: 'jogador@example.com', password: 'senha-errada' }),
      ).rejects.toBeInstanceOf(ApiError);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('authApi.login', () => {
    it('chama /api/bff/auth/login e retorna { user }, nunca tokens', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, validSessionUserResponse));

      const result = await authApi.login({ email: 'jogador@example.com', password: 'senha1234' });

      expect(result).toEqual(validSessionUserResponse);
      const [url] = vi.mocked(fetch).mock.calls[0]!;
      expect(url).toBe('/api/bff/auth/login');
    });
  });

  describe('authApi.session', () => {
    it('chama /api/bff/auth/session e nunca aciona o handler de sessão expirada', async () => {
      const handler = vi.fn();
      setSessionExpiredHandler(handler);
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { status: 'unauthenticated' }));

      const result = await authApi.session();

      expect(result).toEqual({ status: 'unauthenticated' });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('usersApi.uploadAvatar', () => {
    it('envia multipart para /api/bff/users/me/avatar e aciona sessão expirada em 401', async () => {
      const handler = vi.fn();
      setSessionExpiredHandler(handler);
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(401, { message: 'unauthorized' }));

      const file = new File(['conteudo'], 'avatar.png', { type: 'image/png' });
      await expect(usersApi.uploadAvatar(file)).rejects.toBeInstanceOf(ApiError);

      const [url, init] = vi.mocked(fetch).mock.calls[0]!;
      expect(url).toBe('/api/bff/users/me/avatar');
      expect(init?.body).toBeInstanceOf(FormData);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
