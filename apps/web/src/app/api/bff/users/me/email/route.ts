import type { NextRequest } from 'next/server';

import { resolveClientIp } from '@/lib/bff/client-ip';
import { invalidJsonBodyResponse, parseJsonBody } from '@/lib/bff/parse-json-body';
import { ensureFreshAccessToken } from '@/lib/bff/refresh';
import { completeSessionMutation } from '@/lib/bff/session-mutation';
import { getSession } from '@/lib/bff/session';
import { unauthenticatedJson } from '@/lib/bff/proxy';
import { getApiInternalUrl, getBffSharedSecret } from '@/lib/env';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session.refreshToken) {
    return unauthenticatedJson();
  }

  let accessToken: string;
  try {
    accessToken = await ensureFreshAccessToken(session, request);
  } catch {
    return unauthenticatedJson();
  }

  let body: unknown;
  try {
    body = await parseJsonBody(request);
  } catch {
    return invalidJsonBodyResponse();
  }

  const clientIp = resolveClientIp(request);
  const response = await fetch(`${getApiInternalUrl()}/users/me/email`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      'x-bff-secret': getBffSharedSecret(),
      ...(clientIp ? { 'x-forwarded-for': clientIp } : {}),
    },
    body: JSON.stringify(body),
  });

  return completeSessionMutation(session, response);
}
