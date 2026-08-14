import type { NextRequest } from 'next/server';

import { invalidJsonBodyResponse, parseJsonBody } from '@/lib/bff/parse-json-body';
import { proxyJson } from '@/lib/bff/proxy';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await parseJsonBody(request);
  } catch {
    return invalidJsonBodyResponse();
  }
  return proxyJson(null, request, {
    method: 'POST',
    apiPath: '/auth/register',
    requireSession: false,
    body,
  });
}
