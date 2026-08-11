import path from 'node:path';

import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

loadEnvConfig(path.resolve(process.cwd(), '..', '..'));

function buildConnectSrc(): string {
  const sources = [
    "'self'",
    process.env['NEXT_PUBLIC_API_URL'],
    process.env['NEXT_PUBLIC_WS_URL'],

    'wss://*.livekit.cloud',
    'https://*.livekit.cloud',

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

  "script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  `connect-src ${buildConnectSrc()}`,

  `img-src ${buildImgSrc()}`,
  "media-src 'self' blob:",

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
