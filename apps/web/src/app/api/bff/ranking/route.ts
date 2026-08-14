import type { NextRequest } from 'next/server';

import { proxyJson } from '@/lib/bff/proxy';
import { getSession } from '@/lib/bff/session';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await getSession();
  return proxyJson(session, request, {
    method: 'GET',
    apiPath: `/ranking${request.nextUrl.search}`,
  });
}
