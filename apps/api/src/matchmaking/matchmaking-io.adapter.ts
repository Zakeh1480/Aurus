import type { INestApplicationContext } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Server, ServerOptions, Socket } from 'socket.io';

import { getCorsOptions } from '../common/cors.util';
import { RedisService } from '../redis/redis.service';
import { MatchmakingService, userRoom } from './matchmaking.service';
import { WsAuthService } from './ws-auth.service';

/**
 * Middleware de autenticação do handshake do Socket.IO — extraído como
 * função standalone (em vez de inline em createIOServer) só pra ser
 * testável direto, sem precisar mockar `super.createIOServer`/internals do
 * socket.io. Roda DURANTE o handshake, antes do evento `connect` chegar ao
 * cliente — diferente de `handleConnection` (que só roda DEPOIS que o
 * cliente já se considera conectado), fecha a corrida entre autenticação
 * assíncrona (JWT + Postgres) e uma mensagem enviada imediatamente:
 * `socket.data.userId` está garantidamente populado antes de qualquer
 * `@SubscribeMessage` rodar, e um token inválido vira `connect_error` no
 * cliente em vez de um connect-e-desconecta-na-hora.
 *
 * O `socket.join(userRoom(...))` (Prompt 17) é o que faz `MatchmakingService`
 * conseguir emitir/desconectar por userId sem guardar a referência do
 * `Socket` — combinado com o adapter Redis registrado em `createIOServer`,
 * a room é visível (e alcançável) a partir de qualquer réplica da API.
 */
export function createHandshakeAuthMiddleware(
  wsAuthService: WsAuthService,
): (socket: Socket, next: (err?: Error) => void) => void {
  return (socket, next) => {
    const token = socket.handshake.auth?.['token'] as string | undefined;
    wsAuthService
      .authenticate(token)
      .then((userId) => {
        socket.data.userId = userId;
        socket.join(userRoom(userId));
        next();
      })
      .catch(() => next(new Error('Unauthorized')));
  };
}

/**
 * `@WebSocketGateway({ cors: {...} })` seria avaliado no import da classe —
 * antes do `config()` do dotenv rodar em main.ts (mesma armadilha de timing
 * já documentada em auth/auth.module.ts para o JwtModule). Este adapter
 * injeta o CORS na criação do servidor Socket.IO, que só acontece depois
 * do bootstrap, com o env já populado. Usa getCorsOptions() — a mesma fonte
 * de main.ts (REST) — para nunca divergir (Prompt 13).
 *
 * Também registra aqui (Prompt 16) o middleware de autenticação do
 * handshake — antes vivia em `MatchmakingGateway.afterInit()`, mas
 * `MatchScoringGateway` e `AntiCheatGateway` não têm nenhuma autenticação
 * própria: os três coexistem no mesmo `Server`/namespace default, então
 * dependiam inteiramente de `MatchmakingGateway` ser instanciado primeiro
 * pra ter QUALQUER autenticação. Registrar o middleware aqui, na criação do
 * server (bootstrap, `main.ts`), torna a autenticação uma garantia
 * estrutural do adapter em vez de um efeito colateral do lifecycle hook de
 * um gateway específico.
 *
 * Prompt 17 acrescenta o adapter Redis do Socket.IO (`@socket.io/redis-adapter`):
 * sem ele, `server.to(room).emit(...)`/`disconnectSockets()` só alcançam
 * sockets conectados NESTA instância do processo — com múltiplas réplicas da
 * API atrás do load balancer, um evento emitido pela réplica que processou a
 * lógica de negócio nunca chegaria a um socket conectado em outra réplica.
 * O adapter usa dois clientes ioredis dedicados (`pubClient`/`subClient`,
 * via `RedisService.duplicate()`) — nunca a instância `RedisService`
 * compartilhada, porque o cliente "sub" entra em modo subscriber (pub/sub) e
 * fica incapaz de rodar qualquer outro comando (rate limit, nonces, filas),
 * o que quebraria o resto da aplicação.
 */
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

    server.use(createHandshakeAuthMiddleware(this.app.get(WsAuthService)));
    this.app.get(MatchmakingService).setServer(server);

    // `lazyConnect: false`: diferente do RedisService (que adia a conexão
    // pro seu próprio onModuleInit pra logar/falhar de forma controlada),
    // estes clientes precisam estar prontos assim que o server aceita
    // conexões — não há um lifecycle hook do Nest esperando por eles aqui.
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
