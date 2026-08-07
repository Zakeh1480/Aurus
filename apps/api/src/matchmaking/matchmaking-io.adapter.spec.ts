import type { Socket } from 'socket.io';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createHandshakeAuthMiddleware } from './matchmaking-io.adapter';
import type { MatchmakingService } from './matchmaking.service';
import type { WsAuthService } from './ws-auth.service';

function fakeSocket(overrides: Partial<Socket> = {}): Socket {
  return {
    id: 'socket-1',
    data: {},
    handshake: { auth: {} },
    disconnect: vi.fn(),
    emit: vi.fn(),
    ...overrides,
  } as unknown as Socket;
}

/**
 * Migrado de MatchmakingGateway.afterInit (Prompt 16) — a autenticação do
 * handshake agora é registrada em MatchmakingIoAdapter.createIOServer, mas
 * a lógica em si (createHandshakeAuthMiddleware) é testável isolada, sem
 * precisar de um servidor Socket.IO real nem mockar o createIOServer herdado.
 */
describe('createHandshakeAuthMiddleware', () => {
  let matchmakingService: { registerSocket: ReturnType<typeof vi.fn> };
  let wsAuthService: { authenticate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    matchmakingService = { registerSocket: vi.fn() };
    wsAuthService = { authenticate: vi.fn() };
  });

  function buildMiddleware() {
    return createHandshakeAuthMiddleware(
      wsAuthService as unknown as WsAuthService,
      matchmakingService as unknown as MatchmakingService,
    );
  }

  it('aceita e registra o socket quando o token é válido, chamando next() sem erro', async () => {
    wsAuthService.authenticate.mockResolvedValue('user-a');
    const middleware = buildMiddleware();
    const socket = fakeSocket({ handshake: { auth: { token: 'valid-token' } } as never });
    const next = vi.fn();

    middleware(socket, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(socket.data.userId).toBe('user-a');
    expect(matchmakingService.registerSocket).toHaveBeenCalledWith('user-a', socket);
    expect(next).toHaveBeenCalledWith();
  });

  it('chama next(erro) quando o token é inválido — vira connect_error no cliente, nunca chega a conectar', async () => {
    wsAuthService.authenticate.mockRejectedValue(new Error('token inválido'));
    const middleware = buildMiddleware();
    const socket = fakeSocket({ handshake: { auth: { token: 'bad-token' } } as never });
    const next = vi.fn();

    middleware(socket, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(matchmakingService.registerSocket).not.toHaveBeenCalled();
    expect(socket.data.userId).toBeUndefined();
  });

  it('chama next(erro) quando não há token no handshake', async () => {
    wsAuthService.authenticate.mockRejectedValue(new Error('sem token'));
    const middleware = buildMiddleware();
    const socket = fakeSocket({ handshake: { auth: {} } as never });
    const next = vi.fn();

    middleware(socket, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(wsAuthService.authenticate).toHaveBeenCalledWith(undefined);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
