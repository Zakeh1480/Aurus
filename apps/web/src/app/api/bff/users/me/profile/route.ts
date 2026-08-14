import type { NextRequest } from 'next/server';

import { invalidJsonBodyResponse, parseJsonBody } from '@/lib/bff/parse-json-body';
import { proxyJson } from '@/lib/bff/proxy';
import { getSession } from '@/lib/bff/session';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await getSession();
  return proxyJson(session, request, { method: 'GET', apiPath: '/users/me/profile' });
}

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await parseJsonBody(request);
  } catch {
    return invalidJsonBodyResponse();
  }
  const session = await getSession();
  return proxyJson(session, request, { method: 'PATCH', apiPath: '/users/me/profile', body });
}
