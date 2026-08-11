function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

export function getApiUrl(): string {
  return requireEnv('NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL);
}

export function getWsUrl(): string {
  return requireEnv('NEXT_PUBLIC_WS_URL', process.env.NEXT_PUBLIC_WS_URL);
}
