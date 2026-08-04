import { IoAdapter } from "@nestjs/platform-socket.io";
import type { ServerOptions } from "socket.io";

/**
 * `@WebSocketGateway({ cors: {...} })` seria avaliado no import da classe —
 * antes do `config()` do dotenv rodar em main.ts (mesma armadilha de timing
 * já documentada em auth/auth.module.ts para o JwtModule). Este adapter
 * injeta o CORS na criação do servidor Socket.IO, que só acontece depois
 * do bootstrap, com o env já populado.
 */
export class MatchmakingIoAdapter extends IoAdapter {
  override createIOServer(port: number, options?: ServerOptions): ReturnType<IoAdapter["createIOServer"]> {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: process.env["WEB_ORIGIN"] ?? "http://localhost:3000",
        credentials: true,
      },
    });
  }
}
