import type { Consent as PrismaConsent } from "@prisma/client";
import type { Consent } from "@aurafarming/shared";

export function toConsent(consent: PrismaConsent): Consent {
  return {
    id: consent.id,
    userId: consent.userId,
    type: consent.type,
    termsVersion: consent.termsVersion,
    grantedAt: consent.grantedAt.toISOString(),
  };
}
