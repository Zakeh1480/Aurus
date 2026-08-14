import type { NextRequest } from 'next/server';

import { proxyJson } from '@/lib/bff/proxy';
import { getSession } from '@/lib/bff/session';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  return proxyJson(session, { method: 'GET', apiPath: '/users/me/profile' });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const session = await getSession();
  return proxyJson(session, { method: 'PATCH', apiPath: '/users/me/profile', body });
}
