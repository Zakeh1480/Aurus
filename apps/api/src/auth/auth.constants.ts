export const REFRESH_COOKIE_NAME = 'refresh_token';

/**
 * Fixado explicitamente em todo ponto de verificação (JwtStrategy,
 * WsAuthService) em vez de deixar implícito — hoje `jsonwebtoken` já infere
 * só algoritmos HMAC para uma secretOrKey string, mas isso é um detalhe de
 * implementação da lib, não um controle da aplicação. Defesa em profundidade.
 */
export const JWT_ALGORITHM = 'HS256';

export function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error('JWT_SECRET não definido — verifique o .env na raiz do monorepo.');
  }
  return secret;
}

export function getAccessTtlSeconds(): number {
  return Number(process.env['JWT_ACCESS_TTL_SECONDS'] ?? 900);
}

export function getRefreshTtlSeconds(): number {
  return Number(process.env['JWT_REFRESH_TTL_SECONDS'] ?? 604_800);
}
