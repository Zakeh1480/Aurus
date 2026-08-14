import type { NextRequest } from 'next/server';

import { resolveClientIp } from '@/lib/bff/client-ip';
import { invalidJsonBodyResponse, parseJsonBody } from '@/lib/bff/parse-json-body';
import { completeSessionMutation } from '@/lib/bff/session-mutation';
import { getSession } from '@/lib/bff/session';
import { getApiInternalUrl, getBffSharedSecret } from '@/lib/env';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await parseJsonBody(request);
  } catch {
    return invalidJsonBodyResponse();
  }

  const clientIp = resolveClientIp(request);
  const response = await fetch(`${getApiInternalUrl()}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-bff-secret': getBffSharedSecret(),
      ...(clientIp ? { 'x-forwarded-for': clientIp } : {}),
    },
    body: JSON.stringify(body),
  });

  const session = await getSession();
  return completeSessionMutation(session, response);
}
