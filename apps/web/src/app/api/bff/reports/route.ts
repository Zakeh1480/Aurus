import type { NextRequest } from 'next/server';

import { proxyJson } from '@/lib/bff/proxy';
import { getSession } from '@/lib/bff/session';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const session = await getSession();
  return proxyJson(session, { method: 'POST', apiPath: '/reports', body });
}
