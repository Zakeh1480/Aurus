function buildConnectSrc(): string {
  const sources = [
    "'self'",
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

function buildScriptSrc(nonce: string | undefined): string {
  const sources = [
    "'self'",
    "'wasm-unsafe-eval'",
    nonce ? `'nonce-${nonce}'` : undefined,
    'https://cdn.jsdelivr.net',
  ].filter((source): source is string => Boolean(source));
  return sources.join(' ');
}

export function buildCspDirectives(nonce?: string): string {
  return [
    "default-src 'self'",

    `script-src ${buildScriptSrc(nonce)}`,
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
}
