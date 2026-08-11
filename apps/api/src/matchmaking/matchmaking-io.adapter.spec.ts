import type { Socket } from 'socket.io';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WsRateLimiterService } from '../common/ws-rate-limiter.service';
import { createHandshakeAuthMiddleware } from './matchmaking-io.adapter';
import { userRoom } from './matchmaking.service';
import type { WsAuthService } from './ws-auth.service';

function fakeSocket(overrides: Partial<Socket> = {}): Socket {
  return {
    id: 'socket-1',
    data: {},
    handshake: { auth: {}, headers: {}, address: '127.0.0.1' },
    disconnect: vi.fn(),
    emit: vi.fn(),
    join: vi.fn(),
    ...overrides,
  } as unknown as Socket;
}

describe('createHandshakeAuthMiddleware', () => {
  let wsAuthService: { authenticate: ReturnType<typeof vi.fn> };
  let wsRateLimiter: { allow: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    wsAuthService = { authenticate: vi.fn() };
    wsRateLimiter = { allow: vi.fn().mockResolvedValue(true) };
  });

  function buildMiddleware() {
    return createHandshakeAuthMiddleware(
      wsAuthService as unknown as WsAuthService,
      wsRateLimiter as unknown as WsRateLimiterService,
    );
  }

  it('aceita o socket e entra na room do usuário quando o token é válido, chamando next() sem erro', async () => {
    wsAuthService.authenticate.mockResolvedValue('user-a');
    const middleware = buildMiddleware();
    const socket = fakeSocket({ handshake: { auth: { token: 'valid-token' } } as never });
    const next = vi.fn();

    middleware(socket, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(socket.data.userId).toBe('user-a');
    expect(socket.join).toHaveBeenCalledWith(userRoom('user-a'));
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
    expect(socket.join).not.toHaveBeenCalled();
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

  it('rate limit por IP: chama next(erro) e nunca chega a autenticar quando o limite estourou', async () => {
    wsRateLimiter.allow.mockResolvedValue(false);
    const middleware = buildMiddleware();
    const socket = fakeSocket({
      handshake: { auth: { token: 'valid-token' }, headers: {}, address: '9.9.9.9' } as never,
    });
    const next = vi.fn();

    middleware(socket, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(wsRateLimiter.allow).toHaveBeenCalledWith(
      'ws-handshake:9.9.9.9',
      expect.any(Number),
      expect.any(Number),
    );
    expect(wsAuthService.authenticate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('usa o primeiro IP de X-Forwarded-For (um hop confiável) em vez do address direto', async () => {
    wsAuthService.authenticate.mockResolvedValue('user-a');
    const middleware = buildMiddleware();
    const socket = fakeSocket({
      handshake: {
        auth: { token: 'valid-token' },
        headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' },
        address: '9.9.9.9',
      } as never,
    });
    const next = vi.fn();

    middleware(socket, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(wsRateLimiter.allow).toHaveBeenCalledWith(
      'ws-handshake:1.2.3.4',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('falha do rate limiter (ex.: Redis fora do ar) não bloqueia a autenticação — fail open só na checagem de volume', async () => {
    wsRateLimiter.allow.mockRejectedValue(new Error('redis indisponível'));
    wsAuthService.authenticate.mockResolvedValue('user-a');
    const middleware = buildMiddleware();
    const socket = fakeSocket({ handshake: { auth: { token: 'valid-token' } } as never });
    const next = vi.fn();

    middleware(socket, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.userId).toBe('user-a');
  });
});
