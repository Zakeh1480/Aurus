export function getBffSharedSecret(): string {
  const secret = process.env['BFF_SHARED_SECRET'];
  if (!secret) {
    throw new Error('BFF_SHARED_SECRET não definido — verifique o .env na raiz do monorepo.');
  }
  return secret;
}
