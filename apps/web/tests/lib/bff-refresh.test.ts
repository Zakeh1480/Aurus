import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IronSession } from 'iron-session';

import type { BffSessionData } from '../../src/lib/bff/session.js';
import {
  applyUpstreamAuthResponse,
  BffUnauthenticatedError,
  ensureFreshAccessToken,
  refreshSession,
} from '../../src/lib/bff/refresh.js';

const validUser = {
  id: '8f14e45f-ceea-467e-adc6-11a75d3f8e1a',
  email: 'jogador@example.com',
  displayName: 'jogador',
  avatarUrl: null,
  role: 'user',
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
};

const validAuthResponse = {
  user: validUser,
  tokens: { accessToken: 'novo-access-token', expiresIn: 900 },
};

type FakeSession = IronSession<BffSessionData> & {
  save: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

function buildFakeSession(overrides: Partial<BffSessionData> = {}): FakeSession {
  return {
    userId: 'user-1',
    user: validUser,
    accessToken: 'old-access-token',
    accessTokenExpiresAt: Date.now() + 10 * 60_000,
    refreshToken: 'old-refresh-token',
    save: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    updateConfig: vi.fn(),
    ...overrides,
  } as unknown as FakeSession;
}

function refreshResponse(status: number, body: unknown, refreshCookie?: string): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (refreshCookie) {
    headers['set-cookie'] = `refresh_token=${refreshCookie}; Path=/auth; HttpOnly`;
  }
  return new Response(JSON.stringify(body), { status, headers });
}

describe('refresh (BFF)', () => {
  beforeEach(() => {
    process.env.API_INTERNAL_URL = 'http://api.internal:3001';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('ensureFreshAccessToken', () => {
    it('retorna o access token atual sem chamar fetch quando ele ainda está fresco', async () => {
      const session = buildFakeSession({ accessTokenExpiresAt: Date.now() + 10 * 60_000 });

      const token = await ensureFreshAccessToken(session);

      expect(token).toBe('old-access-token');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('refresca quando o access token está a menos de 60s de expirar', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        refreshResponse(200, validAuthResponse, 'novo-refresh-token'),
      );
      const session = buildFakeSession({ accessTokenExpiresAt: Date.now() + 30_000 });

      const token = await ensureFreshAccessToken(session);

      expect(token).toBe('novo-access-token');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('com force:true refresca mesmo se o token ainda estiver fresco', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        refreshResponse(200, validAuthResponse, 'novo-refresh-token'),
      );
      const session = buildFakeSession({ accessTokenExpiresAt: Date.now() + 10 * 60_000 });

      await ensureFreshAccessToken(session, { force: true });

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('lança BffUnauthenticatedError sem chamar fetch quando não há refreshToken', async () => {
      const session = buildFakeSession({ refreshToken: '' });

      await expect(ensureFreshAccessToken(session)).rejects.toBeInstanceOf(BffUnauthenticatedError);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('refreshSession', () => {
    it('reconstrói o header Cookie a partir do refreshToken da sessão', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        refreshResponse(200, validAuthResponse, 'novo-refresh-token'),
      );
      const session = buildFakeSession({ refreshToken: 'refresh-atual' });

      await refreshSession(session);

      const [url, init] = vi.mocked(fetch).mock.calls[0]!;
      expect(url).toBe('http://api.internal:3001/auth/refresh');
      const headers = init?.headers as Record<string, string>;
      expect(headers.cookie).toBe('refresh_token=refresh-atual');
    });

    it('aplica o novo access/refresh token na sessão e salva', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        refreshResponse(200, validAuthResponse, 'novo-refresh-token'),
      );
      const session = buildFakeSession();

      const token = await refreshSession(session);

      expect(token).toBe('novo-access-token');
      expect(session.accessToken).toBe('novo-access-token');
      expect(session.refreshToken).toBe('novo-refresh-token');
      expect(session.accessTokenExpiresAt).toBeGreaterThan(Date.now());
      expect(session.save).toHaveBeenCalledTimes(1);
    });

    it('destrói a sessão e lança BffUnauthenticatedError quando a API rejeita o refresh', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }));
      const session = buildFakeSession();

      await expect(refreshSession(session)).rejects.toBeInstanceOf(BffUnauthenticatedError);
      expect(session.destroy).toHaveBeenCalledTimes(1);
      expect(session.save).not.toHaveBeenCalled();
    });

    it('destrói a sessão e lança quando a resposta não traz Set-Cookie de refresh_token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(refreshResponse(200, validAuthResponse));
      const session = buildFakeSession();

      await expect(refreshSession(session)).rejects.toThrow(/Set-Cookie/);
      expect(session.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('applyUpstreamAuthResponse', () => {
    it('retorna o user aplicado e salva a sessão', async () => {
      const response = refreshResponse(200, validAuthResponse, 'refresh-novo');
      const session = buildFakeSession();

      const user = await applyUpstreamAuthResponse(session, response);

      expect(user).toEqual(validUser);
      expect(session.save).toHaveBeenCalledTimes(1);
    });
  });
});
