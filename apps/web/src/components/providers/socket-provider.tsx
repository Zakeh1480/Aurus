'use client';

import * as React from 'react';

import { createWsClient, type WsClient } from '@/lib/ws-client';

import { useAuth } from './auth-provider';

const SocketContext = React.createContext<WsClient | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { status, accessToken } = useAuth();
  const [client, setClient] = React.useState<WsClient | null>(null);

  React.useEffect(() => {
    if (status !== 'authenticated' || !accessToken) {
      setClient(null);
      return;
    }

    const wsClient = createWsClient(accessToken);
    wsClient.connect();
    setClient(wsClient);

    return () => {
      wsClient.disconnect();
    };
  }, [status, accessToken]);

  return <SocketContext.Provider value={client}>{children}</SocketContext.Provider>;
}

export function useSocket(): WsClient | null {
  return React.useContext(SocketContext);
}
