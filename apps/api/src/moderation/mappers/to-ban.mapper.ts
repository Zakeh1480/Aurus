import type { Ban as PrismaBan } from "@prisma/client";
import type { Ban } from "@aurafarming/shared";

export function toBan(ban: PrismaBan): Ban {
  return {
    id: ban.id,
    userId: ban.userId,
    issuedById: ban.issuedById,
    reason: ban.reason,
    expiresAt: ban.expiresAt ? ban.expiresAt.toISOString() : null,
    liftedAt: ban.liftedAt ? ban.liftedAt.toISOString() : null,
    liftedById: ban.liftedById,
    createdAt: ban.createdAt.toISOString(),
  };
}
