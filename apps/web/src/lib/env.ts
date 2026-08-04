function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

// Resolvidos sob demanda (não no import do módulo): o build do Next.js
// renderiza páginas estáticas em workers separados que não herdam o
// process.env populado por loadEnvConfig em next.config.ts. Lendo só quando
// api-client/ws-client são de fato usados evita quebrar o prerender de
// páginas que não chamam a API/WS.
export function getApiUrl(): string {
  return requireEnv("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL);
}

export function getWsUrl(): string {
  return requireEnv("NEXT_PUBLIC_WS_URL", process.env.NEXT_PUBLIC_WS_URL);
}
