import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions, Socket } from 'socket.io';

import { getCorsOptions } from '../common/cors.util';
import { MatchmakingService } from './matchmaking.service';
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
 */
export function createHandshakeAuthMiddleware(
  wsAuthService: WsAuthService,
  matchmakingService: MatchmakingService,
): (socket: Socket, next: (err?: Error) => void) => void {
  return (socket, next) => {
    const token = socket.handshake.auth?.['token'] as string | undefined;
    wsAuthService
      .authenticate(token)
      .then((userId) => {
        socket.data.userId = userId;
        matchmakingService.registerSocket(userId, socket);
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
 */
export class MatchmakingIoAdapter extends IoAdapter {
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
      createHandshakeAuthMiddleware(this.app.get(WsAuthService), this.app.get(MatchmakingService)),
    );

    return server;
  }
}
