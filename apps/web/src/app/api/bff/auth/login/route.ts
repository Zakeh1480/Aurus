import type { NextRequest } from 'next/server';

import { completeSessionMutation } from '@/lib/bff/session-mutation';
import { getSession } from '@/lib/bff/session';
import { getApiInternalUrl } from '@/lib/env';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const response = await fetch(`${getApiInternalUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const session = await getSession();
  return completeSessionMutation(session, response);
}
