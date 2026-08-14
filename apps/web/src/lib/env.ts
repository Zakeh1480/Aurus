function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

export function getWsUrl(): string {
  return requireEnv('NEXT_PUBLIC_WS_URL', process.env.NEXT_PUBLIC_WS_URL);
}

export function getApiInternalUrl(): string {
  return requireEnv('API_INTERNAL_URL', process.env.API_INTERNAL_URL);
}
