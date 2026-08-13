import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getCorsOptions } from './cors.util';

describe('getCorsOptions', () => {
  const originalWebOrigin = process.env['WEB_ORIGIN'];

  beforeEach(() => {
    delete process.env['WEB_ORIGIN'];
  });

  afterEach(() => {
    if (originalWebOrigin === undefined) {
      delete process.env['WEB_ORIGIN'];
    } else {
      process.env['WEB_ORIGIN'] = originalWebOrigin;
    }
  });

  it('lança erro quando WEB_ORIGIN não está definida, em vez de cair para localhost silenciosamente', () => {
    expect(() => getCorsOptions()).toThrow(/WEB_ORIGIN/);
  });

  it('usa WEB_ORIGIN como origin único com credentials habilitado', () => {
    process.env['WEB_ORIGIN'] = 'https://aurafarming.example';

    expect(getCorsOptions()).toEqual({
      origin: ['https://aurafarming.example'],
      credentials: true,
    });
  });

  it('faz parse de uma lista separada por vírgula, removendo espaços', () => {
    process.env['WEB_ORIGIN'] = 'https://a.example, https://b.example ,https://c.example';

    expect(getCorsOptions()).toEqual({
      origin: ['https://a.example', 'https://b.example', 'https://c.example'],
      credentials: true,
    });
  });
});
