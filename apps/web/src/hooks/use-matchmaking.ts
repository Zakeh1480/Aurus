'use client';

import * as React from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useSocket } from '@/components/providers/socket-provider';
import {
  initialMatchmakingState,
  type MatchmakingState,
  parseWsExceptionMessage,
  reduceMatchmakingState,
} from '@/lib/matchmaking-reducer';

export type UseMatchmakingResult = {
  state: MatchmakingState;

  canJoin: boolean;
  join: () => void;
  leave: () => void;
  accept: () => void;
};

export function useMatchmaking(): UseMatchmakingResult {
  const socket = useSocket();
  const { user } = useAuth();
  const [state, dispatch] = React.useReducer(reduceMatchmakingState, initialMatchmakingState);

  React.useEffect(() => {
    if (!socket) return;

    const offMatched = socket.on('queue:matched', (payload) =>
      dispatch({ type: 'QUEUE_MATCHED', payload }),
    );
    const offStart = socket.on('match:start', (payload) =>
      dispatch({ type: 'MATCH_START', payload }),
    );
    const offEnd = socket.on('match:end', (payload) => dispatch({ type: 'MATCH_END', payload }));

    const onException = (raw: unknown) =>
      dispatch({ type: 'WS_EXCEPTION', message: parseWsExceptionMessage(raw) });
    socket.socket.on('exception', onException);

    return () => {
      offMatched();
      offStart();
      offEnd();
      socket.socket.off('exception', onException);
    };
  }, [socket]);

  const join = React.useCallback(() => {
    if (!socket || !user) return;
    dispatch({ type: 'JOIN_REQUESTED' });
    socket.emit('queue:join', { userId: user.id });
  }, [socket, user]);

  const leave = React.useCallback(() => {
    if (!socket || !user) return;
    dispatch({ type: 'LEAVE_REQUESTED' });
    socket.emit('queue:leave', { userId: user.id });
  }, [socket, user]);

  const accept = React.useCallback(() => {
    if (!socket || state.status !== 'matched') return;
    dispatch({ type: 'ACCEPT_REQUESTED' });
    socket.emit('queue:accept', { matchId: state.matchId });
  }, [socket, state]);

  const canJoin =
    socket !== null && user !== null && (state.status === 'idle' || state.status === 'error');

  return { state, canJoin, join, leave, accept };
}
