import type { INestApplicationContext } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Server, ServerOptions, Socket } from 'socket.io';

import { WsRateLimiterService } from '../common/ws-rate-limiter.service';
import { getCorsOptions } from '../common/cors.util';
import { RedisService } from '../redis/redis.service';
import { MatchmakingService, userRoom } from './matchmaking.service';
import { WsAuthService } from './ws-auth.service';

const HANDSHAKE_RATE_LIMIT = 30;
const HANDSHAKE_RATE_WINDOW_MS = 60_000;

function resolveClientIp(socket: Socket): string {
  const forwardedFor = socket.handshake.headers?.['x-forwarded-for'];
  const last = Array.isArray(forwardedFor) ? forwardedFor.at(-1) : forwardedFor;
  const fromHeader = last
    ?.split(',')
    .map((hop) => hop.trim())
    .at(-1);
  return fromHeader || socket.handshake.address || 'unknown';
}

async function allowHandshake(wsRateLimiter: WsRateLimiterService, ip: string): Promise<boolean> {
  try {
    return await wsRateLimiter.allow(
      `ws-handshake:${ip}`,
      HANDSHAKE_RATE_LIMIT,
      HANDSHAKE_RATE_WINDOW_MS,
    );
  } catch {
    return true;
  }
}

export function createHandshakeAuthMiddleware(
  wsAuthService: WsAuthService,
  wsRateLimiter: WsRateLimiterService,
): (socket: Socket, next: (err?: Error) => void) => void {
  return (socket, next) => {
    void (async () => {
      const ip = resolveClientIp(socket);
      const allowed = await allowHandshake(wsRateLimiter, ip);
      if (!allowed) {
        next(new Error('Too many connection attempts'));
        return;
      }

      const token = socket.handshake.auth?.['token'] as string | undefined;
      try {
        const userId = await wsAuthService.authenticate(token);
        socket.data.userId = userId;
        socket.join(userRoom(userId));
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    })();
  };
}

export class MatchmakingIoAdapter extends IoAdapter {
  private readonly logger = new Logger(MatchmakingIoAdapter.name);
  private pubClient?: Redis;
  private subClient?: Redis;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  override createIOServer(
    port: number,
    options?: ServerOptions,
  ): ReturnType<IoAdapter['createIOServer']> {
    const server = super.createIOServer(port, {
      ...options,
      cors: getCorsOptions(),
    }) as Server;

    server.use(
      createHandshakeAuthMiddleware(
        this.app.get(WsAuthService),
        this.app.get(WsRateLimiterService),
      ),
    );
    this.app.get(MatchmakingService).setServer(server);

    const redisService = this.app.get(RedisService);
    this.pubClient = redisService.duplicate({ lazyConnect: false });
    this.subClient = redisService.duplicate({ lazyConnect: false });
    this.pubClient.on('error', (error) =>
      this.logger.error('Erro no pubClient do adapter Redis', error),
    );
    this.subClient.on('error', (error) =>
      this.logger.error('Erro no subClient do adapter Redis', error),
    );

    server.adapter(createAdapter(this.pubClient, this.subClient));

    return server;
  }

  override async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.all([this.pubClient?.quit(), this.subClient?.quit()]);
  }
}
