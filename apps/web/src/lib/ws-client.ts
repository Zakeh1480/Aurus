import { io, type Socket } from 'socket.io-client';
import { WsEventSchemas, type WsEventName, type WsEventPayload } from '@aurafarming/shared';

import { getWsUrl } from './env';

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

      socket.on(event, wrapped as never);
      return () => {
        socket.off(event, wrapped as never);
      };
    },
  };
}
