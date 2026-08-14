import { REFRESH_COOKIE_NAME } from '@aurafarming/shared';
import { NextResponse } from 'next/server';

import { getSession } from '@/lib/bff/session';
import { getApiInternalUrl } from '@/lib/env';

export const runtime = 'nodejs';

export async function POST() {
  const session = await getSession();
  if (session.refreshToken) {
    await fetch(`${getApiInternalUrl()}/auth/logout`, {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${session.refreshToken}` },
    }).catch(() => undefined);
  }
  session.destroy();
  return NextResponse.json({ success: true });
}
