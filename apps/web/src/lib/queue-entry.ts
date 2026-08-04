import type { SessionState } from "@/hooks/use-session";

/**
 * Decide para onde o CTA "Entrar na fila" deve navegar, dado o estado de
 * sessão/consentimento. `null` enquanto ainda não sabemos a resposta (mantém
 * o botão desabilitado em vez de arriscar uma decisão errada).
 */
export function resolveQueueEntryHref(session: Pick<SessionState, "status" | "cameraConsent">): string | null {
  if (session.status === "loading") {
    return null;
  }

  if (session.status === "unauthenticated") {
    return "/login";
  }

  if (session.cameraConsent === "loading") {
    return null;
  }

  if (session.cameraConsent === "required") {
    return "/consentimento?next=%2Ffila";
  }

  return "/fila";
}
