export const REFRESH_COOKIE_NAME = "refresh_token";

export function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    throw new Error("JWT_SECRET não definido — verifique o .env na raiz do monorepo.");
  }
  return secret;
}

export function getAccessTtlSeconds(): number {
  return Number(process.env["JWT_ACCESS_TTL_SECONDS"] ?? 900);
}

export function getRefreshTtlSeconds(): number {
  return Number(process.env["JWT_REFRESH_TTL_SECONDS"] ?? 604_800);
}
