import { createHmac, timingSafeEqual } from 'node:crypto';

export {
  buildFeaturesSigningPayload,
  buildVerifyResponseSigningPayload,
} from '@aurafarming/shared';

export function signHmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyHmac(payload: string, secret: string, signature: string): boolean {
  const expected = Buffer.from(signHmac(payload, secret), 'hex');
  const actual = Buffer.from(signature, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
