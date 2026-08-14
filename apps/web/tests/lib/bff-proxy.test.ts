import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IronSession } from 'iron-session';
import { NextRequest } from 'next/server';

import type { BffSessionData } from '../../src/lib/bff/session.js';
import { proxyJson, proxyMultipart } from '../../src/lib/bff/proxy.js';

const validUser = {
  id: '8f14e45f-ceea-467e-adc6-11a75d3f8e1a',
  email: 'jogador@example.com',
  displayName: 'jogador',
  avatarUrl: null,
  role: 'user',
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
};

type FakeSession = IronSession<BffSessionData> & {
  save: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

function buildFakeSession(overrides: Partial<BffSessionData> = {}): FakeSession {
  return {
    userId: 'user-1',
    user: validUser,
    accessToken: 'access-token-fresco',
    accessTokenExpiresAt: Date.now() + 10 * 60_000,
    refreshToken: 'refresh-token',
    save: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    updateConfig: vi.fn(),
    ...overrides,
  } as unknown as FakeSession;
}

function jsonResponse(
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  });
}

function buildRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/bff/users/me/profile', { headers });
}

describe('proxyJson', () => {
  beforeEach(() => {
    process.env.API_INTERNAL_URL = 'http://api.internal:3001';
    process.env.BFF_SHARED_SECRET = 'test-bff-secret';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BFF_SHARED_SECRET;
  });

  it('retorna 401 sem chamar fetch quando não há sessão', async () => {
    const response = await proxyJson(null, buildRequest(), {
      method: 'GET',
      apiPath: '/users/me/profile',
    });

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('anexa Authorization: Bearer com o access token da sessão', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const session = buildFakeSession();

    await proxyJson(session, buildRequest(), { method: 'GET', apiPath: '/users/me/profile' });

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('http://api.internal:3001/users/me/profile');
    const headers = init?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer access-token-fresco');
  });

  it('anexa x-bff-secret sempre, e x-forwarded-for quando o request original traz o header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const session = buildFakeSession();

    await proxyJson(session, buildRequest({ 'x-forwarded-for': '1.2.3.4' }), {
      method: 'GET',
      apiPath: '/users/me/profile',
    });

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-bff-secret']).toBe('test-bff-secret');
    expect(headers['x-forwarded-for']).toBe('1.2.3.4');
  });

  it('não anexa x-forwarded-for quando o request original não traz o header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const session = buildFakeSession();

    await proxyJson(session, buildRequest(), { method: 'GET', apiPath: '/users/me/profile' });

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-forwarded-for']).toBeUndefined();
  });

  it('requireSession:false não exige sessão nem anexa Authorization', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await proxyJson(null, buildRequest(), {
      method: 'POST',
      apiPath: '/auth/register',
      requireSession: false,
      body: { a: 1 },
    });

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it('em 401 da API, refresca uma vez (force) e refaz a requisição original', async () => {
    const refreshedAuthResponse = {
      user: validUser,
      tokens: { accessToken: 'access-token-novo', expiresIn: 900 },
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { message: 'unauthorized' }))
      .mockResolvedValueOnce(
        jsonResponse(200, refreshedAuthResponse, {
          'set-cookie': 'refresh_token=novo; Path=/auth',
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const session = buildFakeSession();
    const response = await proxyJson(session, buildRequest(), {
      method: 'GET',
      apiPath: '/users/me/profile',
    });

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(3);
    const [, thirdInit] = vi.mocked(fetch).mock.calls[2]!;
    const headers = thirdInit?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer access-token-novo');
  });

  it('devolve 401 sem tentar de novo quando o próprio refresh falha', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { message: 'unauthorized' }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    const session = buildFakeSession();
    const response = await proxyJson(session, buildRequest(), {
      method: 'GET',
      apiPath: '/users/me/profile',
    });

    expect(response.status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('responde 204 sem corpo quando a API responde 204', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const session = buildFakeSession();

    const response = await proxyJson(session, buildRequest(), {
      method: 'DELETE',
      apiPath: '/users/me',
    });

    expect(response.status).toBe(204);
  });
});

describe('proxyMultipart', () => {
  beforeEach(() => {
    process.env.API_INTERNAL_URL = 'http://api.internal:3001';
    process.env.BFF_SHARED_SECRET = 'test-bff-secret';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BFF_SHARED_SECRET;
  });

  function buildMultipartRequest(): NextRequest {
    const formData = new FormData();
    formData.append('file', new File(['conteudo'], 'avatar.png', { type: 'image/png' }));
    const request = new Request('http://localhost/api/bff/users/me/avatar', {
      method: 'POST',
      body: formData,
    });
    return new NextRequest(request);
  }

  it('retorna 401 sem chamar fetch quando não há sessão', async () => {
    const response = await proxyMultipart(null, buildMultipartRequest(), '/users/me/avatar');

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('repassa o stream com duplex half e o content-type original (boundary incluso)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const session = buildFakeSession();
    const request = buildMultipartRequest();
    const originalContentType = request.headers.get('content-type');

    await proxyMultipart(session, request, '/users/me/avatar');

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect((init as { duplex?: string }).duplex).toBe('half');
    const headers = init?.headers as Record<string, string>;
    expect(headers['content-type']).toBe(originalContentType);
    expect(headers.authorization).toBe('Bearer access-token-fresco');
    expect(headers['x-bff-secret']).toBe('test-bff-secret');
  });

  it('rejeita com 400 quando o Content-Type não é multipart/form-data', async () => {
    const session = buildFakeSession();
    const request = new NextRequest(
      new Request('http://localhost/api/bff/users/me/avatar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );

    const response = await proxyMultipart(session, request, '/users/me/avatar');

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejeita com 413 quando Content-Length excede AVATAR_MAX_FILE_SIZE_BYTES', async () => {
    const session = buildFakeSession();
    const formData = new FormData();
    formData.append('file', new File(['x'], 'avatar.png', { type: 'image/png' }));
    const raw = new Request('http://localhost/api/bff/users/me/avatar', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=x',
        'content-length': '6000000',
      },
      body: formData,
    });
    const request = new NextRequest(raw);

    const response = await proxyMultipart(session, request, '/users/me/avatar');

    expect(response.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('nunca tenta de novo em 401 (o stream já foi consumido, refresh é sempre proativo)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(401, { message: 'unauthorized' }));
    const session = buildFakeSession();

    const response = await proxyMultipart(session, buildMultipartRequest(), '/users/me/avatar');

    expect(response.status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
