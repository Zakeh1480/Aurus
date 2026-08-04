import type { ConsentStatus } from "@aurafarming/shared";

/**
 * Versão dos termos de consentimento de câmera exibidos em `/consentimento`.
 * Não existe uma versão canônica no backend (o campo é uma string livre) —
 * bump manual aqui força os usuários a re-consentir.
 */
export const CAMERA_CONSENT_TERMS_VERSION = "2026-08-04";

export function isCameraConsentGranted(statuses: ConsentStatus[]): boolean {
  return statuses.some((status) => status.type === "camera" && status.granted);
}
