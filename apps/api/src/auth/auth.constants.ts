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

export function getRefreshConcurrentGraceMs(): number {
  return Number(process.env['JWT_REFRESH_CONCURRENT_GRACE_MS'] ?? 5000);
}
