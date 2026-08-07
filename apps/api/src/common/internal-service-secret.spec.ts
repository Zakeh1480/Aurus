import { afterEach, describe, expect, it } from 'vitest';

import { getAiServiceSecret } from './internal-service-secret';

describe('getAiServiceSecret', () => {
  afterEach(() => {
    delete process.env['AI_SERVICE_SHARED_SECRET'];
  });

  it('retorna o valor configurado', () => {
    process.env['AI_SERVICE_SHARED_SECRET'] = 'segredo-real';
    expect(getAiServiceSecret()).toBe('segredo-real');
  });

  it('lança em vez de cair para um literal default quando a env var não está definida', () => {
    delete process.env['AI_SERVICE_SHARED_SECRET'];
    expect(() => getAiServiceSecret()).toThrow();
  });
});
