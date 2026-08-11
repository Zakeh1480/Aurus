import type { Prisma } from '@prisma/client';

export function activeBanWhere(): Prisma.BanWhereInput {
  return { liftedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
}
