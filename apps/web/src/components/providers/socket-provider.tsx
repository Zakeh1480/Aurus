'use client';

import * as React from 'react';

import { wsApi } from '@/lib/api-client';
import { createWsClient, type WsClient } from '@/lib/ws-client';

import { useAuth } from './auth-provider';

const SocketContext = React.createContext<WsClient | null>(null);

async function fetchWsTicket(): Promise<string> {
  const { ticket } = await wsApi.getTicket();
  return ticket;
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [client, setClient] = React.useState<WsClient | null>(null);

  React.useEffect(() => {
    if (status !== 'authenticated') {
      setClient(null);
      return;
    }

    const wsClient = createWsClient(fetchWsTicket);
    wsClient.connect();
    setClient(wsClient);

    return () => {
      wsClient.disconnect();
    };
  }, [status]);

  return <SocketContext.Provider value={client}>{children}</SocketContext.Provider>;
}

export function useSocket(): WsClient | null {
  return React.useContext(SocketContext);
}
