import type { SecurityEvent } from '@aurafarming/shared';
import type { SecurityEvent as PrismaSecurityEvent } from '@prisma/client';

export function toSecurityEvent(event: PrismaSecurityEvent): SecurityEvent {
  return {
    id: event.id,
    userId: event.userId,
    type: event.type,
    metadata: event.metadata as Record<string, unknown> | null,
    createdAt: event.createdAt.toISOString(),
  };
}
