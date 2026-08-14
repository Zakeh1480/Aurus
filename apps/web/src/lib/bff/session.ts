import type { User } from '@aurafarming/shared';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export type BffSessionData = {
  userId: string;
  user: User;
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
};

const SESSION_COOKIE_NAME = 'aurafarming_session';
const MIN_SESSION_SECRET_LENGTH = 32;

function getSessionSecret(): string {
  const secret = process.env['BFF_SESSION_SECRET'];
  if (!secret) {
    throw new Error('BFF_SESSION_SECRET não definido — verifique o .env na raiz do monorepo.');
  }
  if (secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `BFF_SESSION_SECRET precisa ter pelo menos ${MIN_SESSION_SECRET_LENGTH} caracteres.`,
    );
  }
  return secret;
}

function isSecureCookie(): boolean {
  const override = process.env['BFF_SESSION_COOKIE_SECURE'];
  if (override === 'true') return true;
  if (override === 'false') return false;
  return process.env['NODE_ENV'] === 'production';
}

function getRefreshTtlSeconds(): number {
  return Number(process.env['JWT_REFRESH_TTL_SECONDS'] ?? 604_800);
}

export function sessionOptions(): SessionOptions {
  return {
    password: getSessionSecret(),
    cookieName: SESSION_COOKIE_NAME,
    cookieOptions: {
      httpOnly: true,
      secure: isSecureCookie(),
      sameSite: 'strict',
      path: '/',
      maxAge: getRefreshTtlSeconds(),
    },
  };
}

export async function getSession(): Promise<IronSession<BffSessionData>> {
  return getIronSession<BffSessionData>(await cookies(), sessionOptions());
}
