import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { getWsTicketTtlSeconds } from './matchmaking.constants';

const TICKET_BYTES = 32;

@Injectable()
export class WsTicketService {
  constructor(private readonly redis: RedisService) {}

  async issue(userId: string): Promise<{ ticket: string; expiresAt: Date }> {
    const ttlSeconds = getWsTicketTtlSeconds();
    const ticket = randomBytes(TICKET_BYTES).toString('base64url');
    await this.redis.set(this.key(ticket), userId, 'EX', ttlSeconds);
    return { ticket, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
  }

  consume(ticket: string): Promise<string | null> {
    return this.redis.getdel(this.key(ticket));
  }

  private key(ticket: string): string {
    return `mm:ws-ticket:${ticket}`;
  }
}
