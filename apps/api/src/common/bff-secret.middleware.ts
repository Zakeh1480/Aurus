import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { getBffSharedSecret } from './bff-shared-secret';

export const BFF_SECRET_HEADER = 'x-bff-secret';
export const BFF_SECRET_EXEMPT_PATHS = new Set(['/health', '/livekit/webhook']);

export function isValidBffSecret(candidate: string | undefined, expected: string): boolean {
  if (!candidate) {
    return false;
  }
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

export function bffSecretMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (BFF_SECRET_EXEMPT_PATHS.has(req.path)) {
    next();
    return;
  }

  if (!isValidBffSecret(req.header(BFF_SECRET_HEADER), getBffSharedSecret())) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  next();
}
