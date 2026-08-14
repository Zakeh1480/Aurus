import { SessionUserResponseSchema } from '@aurafarming/shared';
import type { IronSession } from 'iron-session';
import { NextResponse } from 'next/server';

import { applyUpstreamAuthResponse } from './refresh';
import type { BffSessionData } from './session';

export async function completeSessionMutation(
  session: IronSession<BffSessionData>,
  response: Response,
): Promise<NextResponse> {
  if (!response.ok) {
    const raw = response.status === 204 ? undefined : await response.json().catch(() => undefined);
    return NextResponse.json(raw, { status: response.status });
  }

  const user = await applyUpstreamAuthResponse(session, response);
  return NextResponse.json(SessionUserResponseSchema.parse({ user }));
}
