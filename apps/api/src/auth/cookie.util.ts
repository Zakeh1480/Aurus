import type { Response } from 'express';

import { getRefreshTtlSeconds, REFRESH_COOKIE_NAME } from './auth.constants';

const COOKIE_PATH = '/auth';

export function isSecureCookie(): boolean {
  const override = process.env['COOKIE_SECURE'];
  if (override === 'true') return true;
  if (override === 'false') return false;
  return process.env['NODE_ENV'] === 'production';
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: getRefreshTtlSeconds() * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: COOKIE_PATH });
}
