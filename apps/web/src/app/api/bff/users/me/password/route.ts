import type { NextRequest } from 'next/server';

import { ensureFreshAccessToken } from '@/lib/bff/refresh';
import { completeSessionMutation } from '@/lib/bff/session-mutation';
import { getSession } from '@/lib/bff/session';
import { unauthenticatedJson } from '@/lib/bff/proxy';
import { getApiInternalUrl } from '@/lib/env';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session.refreshToken) {
    return unauthenticatedJson();
  }

  let accessToken: string;
  try {
    accessToken = await ensureFreshAccessToken(session);
  } catch {
    return unauthenticatedJson();
  }

  const body = await request.json();
  const response = await fetch(`${getApiInternalUrl()}/users/me/password`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });

  return completeSessionMutation(session, response);
}
