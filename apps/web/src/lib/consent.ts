import type { ConsentStatus } from '@aurafarming/shared';

export const CAMERA_CONSENT_TERMS_VERSION = '2026-08-04';

export function isCameraConsentGranted(statuses: ConsentStatus[]): boolean {
  return statuses.some((status) => status.type === 'camera' && status.granted);
}
