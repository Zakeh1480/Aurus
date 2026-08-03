import type { Response } from "express";

import { getRefreshTtlSeconds, REFRESH_COOKIE_NAME } from "./auth.constants";

const COOKIE_PATH = "/auth";

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: getRefreshTtlSeconds() * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: COOKIE_PATH });
}
