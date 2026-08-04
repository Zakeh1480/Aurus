import { beforeEach, describe, expect, it, vi } from "vitest";

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
  return { io: vi.fn(() => fakeSocket), fakeSocket, handlers };
});

vi.mock("socket.io-client", () => ({ io }));

const { createWsClient } = await import("../../src/lib/ws-client.js");

describe("wsClient", () => {
  beforeEach(() => {
    handlers.clear();
    io.mockClear();
    fakeSocket.emit.mockClear();
    fakeSocket.on.mockClear();
    fakeSocket.off.mockClear();
    fakeSocket.connect.mockClear();
    fakeSocket.disconnect.mockClear();
  });

  it("conecta com autoConnect desabilitado e o token no handshake", () => {
    createWsClient("meu-token");

    expect(io).toHaveBeenCalledWith("ws://localhost:3001", {
      autoConnect: false,
      auth: { token: "meu-token" },
    });
  });

  it("emit valida o payload contra WsEventSchemas antes de repassar ao socket", () => {
    const client = createWsClient("meu-token");

    client.emit("queue:join", { userId: "8f14e45f-ceea-467e-adc6-11a75d3f8e1a" });

    expect(fakeSocket.emit).toHaveBeenCalledWith("queue:join", {
      userId: "8f14e45f-ceea-467e-adc6-11a75d3f8e1a",
    });
  });

  it("emit lança se o payload não bate com o schema do evento", () => {
    const client = createWsClient("meu-token");

    expect(() => client.emit("queue:join", { userId: "não-é-uuid" } as never)).toThrow();
    expect(fakeSocket.emit).not.toHaveBeenCalled();
  });

  it("on descarta payloads que falham a validação, sem chamar o handler", () => {
    const client = createWsClient("meu-token");
    const handler = vi.fn();

    client.on("queue:matched", handler);
    handlers.get("queue:matched")?.({ nonsense: true });

    expect(handler).not.toHaveBeenCalled();
  });
});
