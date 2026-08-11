import path from 'node:path';

import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// O .env do monorepo fica na raiz (mesma convenção de apps/api/src/main.ts) —
// Next.js só carrega .env do diretório do próprio app por padrão.
loadEnvConfig(path.resolve(process.cwd(), '..', '..'));

// Lidas diretamente (não via requireEnv de lib/env.ts, que lança se ausente)
// porque next.config roda em build time — a CI hoje builda sem essas vars
// setadas, e a CSP não pode quebrar esse build. Origem ausente = só some do
// connect-src (degradação aceitável), nunca falha o build.
function buildConnectSrc(): string {
  const sources = [
    "'self'",
    process.env['NEXT_PUBLIC_API_URL'],
    process.env['NEXT_PUBLIC_WS_URL'],
    // LiveKit Cloud é a escolha fixa do MVP (CLAUDE.md) — a URL real só
    // chega ao client via POST /matches/:id/token, nunca por NEXT_PUBLIC_*,
    // então o domínio é allowlistado por wildcard em vez de por env var.
    'wss://*.livekit.cloud',
    'https://*.livekit.cloud',
    // MediaPipe WASM/modelo (face-landmarker-runtime.ts) — buscados de CDN
    // em runtime, não empacotados pelo bundler.
    'https://cdn.jsdelivr.net',
    'https://storage.googleapis.com',
  ].filter((source): source is string => Boolean(source));
  return sources.join(' ');
}

function buildImgSrc(): string {
  const sources = [
    "'self'",
    'data:',
    'blob:',
    process.env['NEXT_PUBLIC_AVATAR_PUBLIC_BASE_URL'],
  ].filter((source): source is string => Boolean(source));
  return sources.join(' ');
}

const CSP_DIRECTIVES = [
  "default-src 'self'",
  // 'wasm-unsafe-eval': MediaPipe roda inferência via WASM no cliente (regra
  // de ouro #5) — sem essa diretiva o carregamento do módulo WASM falha.
  "script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  `connect-src ${buildConnectSrc()}`,
  // blob: cobre preview local de avatar antes do upload; data: cobre ícones
  // inline; NEXT_PUBLIC_AVATAR_PUBLIC_BASE_URL cobre o avatar já hospedado.
  `img-src ${buildImgSrc()}`,
  "media-src 'self' blob:",
  // Tailwind/shadcn não usam nonce hoje — 'unsafe-inline' é o trade-off aceito.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // camera=(self) preserva o uso legítimo da câmera nas partidas — não é deny-all.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Content-Security-Policy', value: CSP_DIRECTIVES },
        ],
      },
    ];
  },
};

export default nextConfig;
