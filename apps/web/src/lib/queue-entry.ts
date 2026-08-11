import type { SessionState } from '@/hooks/use-session';

export function resolveQueueEntryHref(
  session: Pick<SessionState, 'status' | 'cameraConsent'>,
): string | null {
  if (session.status === 'loading') {
    return null;
  }

  if (session.status === 'unauthenticated') {
    return '/login';
  }

  if (session.cameraConsent === 'loading') {
    return null;
  }

  if (session.cameraConsent === 'required') {
    return '/consentimento?next=%2Ffila';
  }

  return '/fila';
}
