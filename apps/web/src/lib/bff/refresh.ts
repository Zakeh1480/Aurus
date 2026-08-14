import { AuthResponseSchema, REFRESH_COOKIE_NAME } from '@aurafarming/shared';
import type { IronSession } from 'iron-session';

import { getApiInternalUrl } from '../env';
import type { BffSessionData } from './session';

const REFRESH_MARGIN_MS = 60_000;

export class BffUnauthenticatedError extends Error {}

function extractSetCookieValue(setCookieHeaders: string[], cookieName: string): string | undefined {
  for (const header of setCookieHeaders) {
    const [pair] = header.split(';');
    const [name, value] = (pair ?? '').split('=');
    if (name?.trim() === cookieName) {
      return value;
    }
  }
  return undefined;
}

export async function applyUpstreamAuthResponse(
  session: IronSession<BffSessionData>,
  response: Response,
) {
  const parsed = AuthResponseSchema.parse(await response.json());
  const newRefreshToken = extractSetCookieValue(
    response.headers.getSetCookie(),
    REFRESH_COOKIE_NAME,
  );
  if (!newRefreshToken) {
    session.destroy();
    throw new Error('Resposta da API sem Set-Cookie de refresh_token.');
  }

  session.userId = parsed.user.id;
  session.user = parsed.user;
  session.accessToken = parsed.tokens.accessToken;
  session.accessTokenExpiresAt = Date.now() + parsed.tokens.expiresIn * 1000;
  session.refreshToken = newRefreshToken;
  await session.save();
  return parsed.user;
}

export async function ensureFreshAccessToken(
  session: IronSession<BffSessionData>,
  options: { force?: boolean } = {},
): Promise<string> {
  if (!session.refreshToken) {
    throw new BffUnauthenticatedError();
  }
  if (!options.force && session.accessTokenExpiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return session.accessToken;
  }
  return refreshSession(session);
}

export async function refreshSession(session: IronSession<BffSessionData>): Promise<string> {
  const response = await fetch(`${getApiInternalUrl()}/auth/refresh`, {
    method: 'POST',
    headers: { cookie: `${REFRESH_COOKIE_NAME}=${session.refreshToken}` },
  });

  if (!response.ok) {
    session.destroy();
    throw new BffUnauthenticatedError();
  }

  await applyUpstreamAuthResponse(session, response);
  return session.accessToken;
}
