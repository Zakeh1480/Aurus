import { beforeEach, describe, expect, it, vi } from 'vitest';

const { io, fakeSocket, handlers } = vi.hoisted(() => {
  const handlers = new Map<string, (payload: unknown) => void>();
  const fakeSocket = {
    emit: vi.fn(),
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      handlers.set(event, handler);
    }),
    off: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const io = vi.fn((_url: string, _options: { autoConnect: boolean; auth: unknown }) => fakeSocket);
  return { io, fakeSocket, handlers };
});

vi.mock('socket.io-client', () => ({ io }));

const { createWsClient } = await import('../../src/lib/ws-client.js');

type AuthFn = (cb: (data: object) => void) => void;

function getAuthFn(): AuthFn {
  const lastCall = io.mock.calls.at(-1)!;
  const options = lastCall[1];
  return options.auth as AuthFn;
}

describe('wsClient', () => {
  beforeEach(() => {
    handlers.clear();
    io.mockClear();
    fakeSocket.emit.mockClear();
    fakeSocket.on.mockClear();
    fakeSocket.off.mockClear();
    fakeSocket.connect.mockClear();
    fakeSocket.disconnect.mockClear();
  });

  it('conecta com autoConnect desabilitado e auth como função (não um objeto estático)', () => {
    createWsClient(async () => 'algum-ticket');

    expect(io).toHaveBeenCalledWith('ws://localhost:3001', {
      autoConnect: false,
      auth: expect.any(Function),
    });
  });

  it('auth busca um ticket novo e chama o callback do socket.io com { ticket }', async () => {
    const getTicket = vi.fn().mockResolvedValue('ticket-fresco');
    createWsClient(getTicket);

    const callback = vi.fn();
    getAuthFn()(callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    expect(getTicket).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ ticket: 'ticket-fresco' });
  });

  it('auth chama o callback com payload vazio se getTicket falhar (deixa o servidor rejeitar)', async () => {
    const getTicket = vi.fn().mockRejectedValue(new Error('sem sessão'));
    createWsClient(getTicket);

    const callback = vi.fn();
    getAuthFn()(callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    expect(callback).toHaveBeenCalledWith({});
  });

  it('busca um ticket novo a cada chamada de auth (cada tentativa de conexão/reconexão)', async () => {
    const getTicket = vi.fn().mockResolvedValueOnce('ticket-1').mockResolvedValueOnce('ticket-2');
    createWsClient(getTicket);
    const authFn = getAuthFn();

    const firstCallback = vi.fn();
    authFn(firstCallback);
    await vi.waitFor(() => expect(firstCallback).toHaveBeenCalledWith({ ticket: 'ticket-1' }));

    const secondCallback = vi.fn();
    authFn(secondCallback);
    await vi.waitFor(() => expect(secondCallback).toHaveBeenCalledWith({ ticket: 'ticket-2' }));

    expect(getTicket).toHaveBeenCalledTimes(2);
  });

  it('emit valida o payload contra WsEventSchemas antes de repassar ao socket', () => {
    const client = createWsClient(async () => 'ticket');

    client.emit('queue:join', { userId: '8f14e45f-ceea-467e-adc6-11a75d3f8e1a' });

    expect(fakeSocket.emit).toHaveBeenCalledWith('queue:join', {
      userId: '8f14e45f-ceea-467e-adc6-11a75d3f8e1a',
    });
  });

  it('emit lança se o payload não bate com o schema do evento', () => {
    const client = createWsClient(async () => 'ticket');

    expect(() => client.emit('queue:join', { userId: 'não-é-uuid' } as never)).toThrow();
    expect(fakeSocket.emit).not.toHaveBeenCalled();
  });

  it('on descarta payloads que falham a validação, sem chamar o handler', () => {
    const client = createWsClient(async () => 'ticket');
    const handler = vi.fn();

    client.on('queue:matched', handler);
    handlers.get('queue:matched')?.({ nonsense: true });

    expect(handler).not.toHaveBeenCalled();
  });
});
