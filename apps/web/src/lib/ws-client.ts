import { io, type Socket } from "socket.io-client";
import { WsEventSchemas, type WsEventName, type WsEventPayload } from "@aurafarming/shared";

import { getWsUrl } from "./env";

export type WsClient = {
  readonly socket: Socket;
  connect(): void;
  disconnect(): void;
  emit<E extends WsEventName>(event: E, payload: WsEventPayload<E>): void;
  on<E extends WsEventName>(event: E, handler: (payload: WsEventPayload<E>) => void): () => void;
};

export function createWsClient(token: string): WsClient {
  const socket = io(getWsUrl(), { autoConnect: false, auth: { token } });

  return {
    socket,
    connect() {
      socket.connect();
    },
    disconnect() {
      socket.disconnect();
    },
    emit(event, payload) {
      // Payload sai do nosso próprio código — falha aqui é erro do programador, deve estourar.
      WsEventSchemas[event].parse(payload);
      socket.emit(event, payload);
    },
    on(event, handler) {
      const wrapped = (raw: unknown) => {
        const result = WsEventSchemas[event].safeParse(raw);
        if (!result.success) {
          console.error(`[ws] payload inválido para "${event}"`, result.error);
          return;
        }
        handler(result.data as WsEventPayload<typeof event>);
      };
      // Socket.IO tipa on/off por literal de evento; nosso wrapper é genérico
      // sobre WsEventName, então o TS não resolve a condicional — o cast é
      // seguro porque `wrapped` já valida o payload em runtime via safeParse.
      socket.on(event, wrapped as never);
      return () => {
        socket.off(event, wrapped as never);
      };
    },
  };
}
