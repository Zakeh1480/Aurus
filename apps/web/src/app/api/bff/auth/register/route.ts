import type { NextRequest } from 'next/server';

import { proxyJson } from '@/lib/bff/proxy';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyJson(null, {
    method: 'POST',
    apiPath: '/auth/register',
    requireSession: false,
    body,
  });
}
