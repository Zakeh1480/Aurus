import type { User as PrismaUser } from '@prisma/client';
import type { User } from '@aurafarming/shared';

export function toPublicUser(user: PrismaUser): User {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
