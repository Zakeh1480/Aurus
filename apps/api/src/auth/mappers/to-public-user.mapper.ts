import type { User as PrismaUser } from "@prisma/client";
import type { User } from "@aurafarming/shared";

/**
 * Monta o objeto campo a campo (nunca `{ ...user }`) para garantir
 * mecanicamente que `passwordHash`/`anonymizedAt` nunca saem da API.
 */
export function toPublicUser(user: PrismaUser): User {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
