import type {
  SecurityEventListQuery,
  SecurityEventListResponse,
  SecurityEventType,
} from '@aurafarming/shared';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { toSecurityEvent } from './mappers/to-security-event.mapper';

export interface RecordSecurityEventInput {
  type: SecurityEventType;
  userId: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class SecurityEventService {
  private readonly logger = new Logger(SecurityEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordSecurityEventInput): Promise<void> {
    try {
      await this.prisma.securityEvent.create({
        data: {
          type: input.type,
          userId: input.userId,
          metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        },
      });
    } catch (error) {
      this.logger.error(`Falha ao registrar SecurityEvent (${input.type})`, error as Error);
    }
  }

  async list(query: SecurityEventListQuery): Promise<SecurityEventListResponse> {
    const where = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };
    const [events, total] = await Promise.all([
      this.prisma.securityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.securityEvent.count({ where }),
    ]);
    return {
      entries: events.map(toSecurityEvent),
      limit: query.limit,
      offset: query.offset,
      total,
    };
  }
}
