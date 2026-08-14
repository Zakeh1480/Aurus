import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionOptions } from '../../src/lib/bff/session.js';

describe('sessionOptions', () => {
  beforeEach(() => {
    vi.stubEnv('BFF_SESSION_SECRET', 'a'.repeat(32));
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('BFF_SESSION_COOKIE_SECURE', undefined);
    vi.stubEnv('JWT_REFRESH_TTL_SECONDS', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('usa o nome de cookie aurafarming_session, httpOnly, sameSite strict, path /', () => {
    const options = sessionOptions();

    expect(options.cookieName).toBe('aurafarming_session');
    expect(options.cookieOptions?.httpOnly).toBe(true);
    expect(options.cookieOptions?.sameSite).toBe('strict');
    expect(options.cookieOptions?.path).toBe('/');
  });

  it('deriva maxAge de JWT_REFRESH_TTL_SECONDS (default 604800)', () => {
    const options = sessionOptions();
    expect(options.cookieOptions?.maxAge).toBe(604_800);
  });

  it('respeita JWT_REFRESH_TTL_SECONDS customizado', () => {
    vi.stubEnv('JWT_REFRESH_TTL_SECONDS', '1200');
    const options = sessionOptions();
    expect(options.cookieOptions?.maxAge).toBe(1200);
  });

  it('secure é false fora de produção por padrão', () => {
    const options = sessionOptions();
    expect(options.cookieOptions?.secure).toBe(false);
  });

  it('secure é true quando NODE_ENV=production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const options = sessionOptions();
    expect(options.cookieOptions?.secure).toBe(true);
  });

  it('BFF_SESSION_COOKIE_SECURE=true força secure mesmo fora de produção', () => {
    vi.stubEnv('BFF_SESSION_COOKIE_SECURE', 'true');
    const options = sessionOptions();
    expect(options.cookieOptions?.secure).toBe(true);
  });

  it('BFF_SESSION_COOKIE_SECURE=false força secure=false mesmo em produção', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BFF_SESSION_COOKIE_SECURE', 'false');
    const options = sessionOptions();
    expect(options.cookieOptions?.secure).toBe(false);
  });

  it('lança se BFF_SESSION_SECRET não estiver definido', () => {
    vi.stubEnv('BFF_SESSION_SECRET', undefined);
    expect(() => sessionOptions()).toThrow();
  });

  it('lança se BFF_SESSION_SECRET tiver menos de 32 caracteres', () => {
    vi.stubEnv('BFF_SESSION_SECRET', 'curto-demais');
    expect(() => sessionOptions()).toThrow();
  });
});
