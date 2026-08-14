import { BffSessionStatusResponseSchema } from '@aurafarming/shared';
import { NextResponse } from 'next/server';

import { ensureFreshAccessToken } from '@/lib/bff/refresh';
import { getSession } from '@/lib/bff/session';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session.refreshToken) {
    return NextResponse.json(BffSessionStatusResponseSchema.parse({ status: 'unauthenticated' }));
  }

  try {
    await ensureFreshAccessToken(session, request);
  } catch {
    return NextResponse.json(BffSessionStatusResponseSchema.parse({ status: 'unauthenticated' }));
  }

  return NextResponse.json(
    BffSessionStatusResponseSchema.parse({ status: 'authenticated', user: session.user }),
  );
}
