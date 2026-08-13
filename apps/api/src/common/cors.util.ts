import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function getCorsOptions(): CorsOptions {
  const webOrigin = process.env['WEB_ORIGIN'];
  if (!webOrigin) {
    throw new Error('WEB_ORIGIN não definido — verifique o .env na raiz do monorepo.');
  }
  const origins = webOrigin.split(',').map((origin) => origin.trim());
  return { origin: origins, credentials: true };
}
