import { describe, expect, it } from 'vitest';

import { resolveClientIp } from '../../src/lib/bff/client-ip.js';

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/bff/ranking', { headers });
}

describe('resolveClientIp', () => {
  it('retorna undefined quando não há X-Forwarded-For', () => {
    expect(resolveClientIp(requestWithHeaders({}))).toBeUndefined();
  });

  it('retorna o único valor quando há um só IP', () => {
    const request = requestWithHeaders({ 'x-forwarded-for': '1.2.3.4' });
    expect(resolveClientIp(request)).toBe('1.2.3.4');
  });

  it('retorna o primeiro hop (o cliente original reportado pela borda) quando há vários', () => {
    const request = requestWithHeaders({ 'x-forwarded-for': '1.2.3.4, 9.9.9.9' });
    expect(resolveClientIp(request)).toBe('1.2.3.4');
  });

  it('remove espaços em volta do primeiro hop', () => {
    const request = requestWithHeaders({ 'x-forwarded-for': '  1.2.3.4  , 9.9.9.9' });
    expect(resolveClientIp(request)).toBe('1.2.3.4');
  });
});
