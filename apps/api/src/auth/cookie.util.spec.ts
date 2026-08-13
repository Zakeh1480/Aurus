import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isSecureCookie } from './cookie.util';

describe('isSecureCookie', () => {
  const originalNodeEnv = process.env['NODE_ENV'];
  const originalCookieSecure = process.env['COOKIE_SECURE'];

  beforeEach(() => {
    delete process.env['NODE_ENV'];
    delete process.env['COOKIE_SECURE'];
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = originalNodeEnv;
    }
    if (originalCookieSecure === undefined) {
      delete process.env['COOKIE_SECURE'];
    } else {
      process.env['COOKIE_SECURE'] = originalCookieSecure;
    }
  });

  it('sem override e fora de produção, retorna false', () => {
    expect(isSecureCookie()).toBe(false);
  });

  it('sem override e com NODE_ENV=production, retorna true', () => {
    process.env['NODE_ENV'] = 'production';
    expect(isSecureCookie()).toBe(true);
  });

  it('COOKIE_SECURE=true força true mesmo fora de produção', () => {
    process.env['COOKIE_SECURE'] = 'true';
    expect(isSecureCookie()).toBe(true);
  });

  it('COOKIE_SECURE=false força false mesmo com NODE_ENV=production', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['COOKIE_SECURE'] = 'false';
    expect(isSecureCookie()).toBe(false);
  });
});
