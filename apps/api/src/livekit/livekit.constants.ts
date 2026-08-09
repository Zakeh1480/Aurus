export interface LivekitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

export function getLivekitConfig(): LivekitConfig {
  const url = process.env['LIVEKIT_URL'];
  const apiKey = process.env['LIVEKIT_API_KEY'];
  const apiSecret = process.env['LIVEKIT_API_SECRET'];
  if (!url || !apiKey || !apiSecret) {
    throw new Error(
      'LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET não definidos — verifique o .env na raiz do monorepo.',
    );
  }
  return { url, apiKey, apiSecret };
}

export function getLivekitTokenTtlSeconds(): number {
  return Number(process.env['LIVEKIT_TOKEN_TTL_SECONDS'] ?? 7200);
}

/** Cadência do poller cross-instance que varre `lk:match-duration:expiry` por partidas com tempo esgotado. */
export function getMatchDurationPollIntervalMs(): number {
  return Number(process.env['MATCH_DURATION_POLL_INTERVAL_MS'] ?? 1000);
}

/** RoomServiceClient exige host http(s); LIVEKIT_URL vem em ws(s):// por convenção do LiveKit Cloud. */
export function toHttpUrl(livekitUrl: string): string {
  return livekitUrl.replace(/^ws/, 'http');
}
