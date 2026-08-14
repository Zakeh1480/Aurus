import { afterEach, describe, expect, it } from 'vitest';

import { getBffSharedSecret } from './bff-shared-secret';

describe('getBffSharedSecret', () => {
  afterEach(() => {
    delete process.env['BFF_SHARED_SECRET'];
  });

  it('retorna o valor configurado', () => {
    process.env['BFF_SHARED_SECRET'] = 'segredo-real';
    expect(getBffSharedSecret()).toBe('segredo-real');
  });

  it('lança em vez de cair para um literal default quando a env var não está definida', () => {
    delete process.env['BFF_SHARED_SECRET'];
    expect(() => getBffSharedSecret()).toThrow();
  });
});
