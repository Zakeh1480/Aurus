import { describe, expect, it } from 'vitest';

import {
  InvalidJsonBodyError,
  invalidJsonBodyResponse,
  parseJsonBody,
} from '../../src/lib/bff/parse-json-body.js';

describe('parseJsonBody', () => {
  it('retorna o corpo parseado quando o JSON é válido', async () => {
    const request = new Request('http://localhost/api/bff/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });

    await expect(parseJsonBody(request)).resolves.toEqual({ a: 1 });
  });

  it('lança InvalidJsonBodyError quando o corpo não é JSON válido', async () => {
    const request = new Request('http://localhost/api/bff/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'isso não é json',
    });

    await expect(parseJsonBody(request)).rejects.toBeInstanceOf(InvalidJsonBodyError);
  });
});

describe('invalidJsonBodyResponse', () => {
  it('retorna 400 com uma mensagem', async () => {
    const response = invalidJsonBodyResponse();

    expect(response.status).toBe(400);
    const body = (await response.json()) as { message: string };
    expect(body.message).toBeTruthy();
  });
});
