import type { NextRequest } from 'next/server';

import { proxyMultipart } from '@/lib/bff/proxy';
import { getSession } from '@/lib/bff/session';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const session = await getSession();
  return proxyMultipart(session, request, '/users/me/avatar');
}
