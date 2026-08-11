export function getAiServiceSecret(): string {
  const secret = process.env['AI_SERVICE_SHARED_SECRET'];
  if (!secret) {
    throw new Error(
      'AI_SERVICE_SHARED_SECRET não definido — verifique o .env na raiz do monorepo.',
    );
  }
  return secret;
}
