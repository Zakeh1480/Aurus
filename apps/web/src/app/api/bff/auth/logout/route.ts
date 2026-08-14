import { REFRESH_COOKIE_NAME } from '@aurafarming/shared';
import { NextResponse } from 'next/server';

import { resolveClientIp } from '@/lib/bff/client-ip';
import { getSession } from '@/lib/bff/session';
import { getApiInternalUrl, getBffSharedSecret } from '@/lib/env';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await getSession();
  if (session.refreshToken) {
    const clientIp = resolveClientIp(request);
    await fetch(`${getApiInternalUrl()}/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: `${REFRESH_COOKIE_NAME}=${session.refreshToken}`,
        'x-bff-secret': getBffSharedSecret(),
        ...(clientIp ? { 'x-forwarded-for': clientIp } : {}),
      },
    }).catch(() => undefined);
  }
  session.destroy();
  return NextResponse.json({ success: true });
}
