import type { MatchEndPayload, MatchStartPayload, QueueMatchedPayload } from '@aurafarming/shared';

export type MatchmakingState =
  | { status: 'idle'; notice?: string }
  | { status: 'queueing'; notice?: string }
  | {
      status: 'matched';
      matchId: string;
      opponentId: string;
      matchedAt: string;
      accepted: boolean;
      leaveRequested: boolean;
    }
  | { status: 'redirecting'; matchId: string }
  | { status: 'error'; message: string };

export type MatchmakingAction =
  | { type: 'JOIN_REQUESTED' }
  | { type: 'LEAVE_REQUESTED' }
  | { type: 'ACCEPT_REQUESTED' }
  | { type: 'QUEUE_MATCHED'; payload: QueueMatchedPayload }
  | { type: 'MATCH_START'; payload: MatchStartPayload }
  | { type: 'MATCH_END'; payload: MatchEndPayload }
  | { type: 'WS_EXCEPTION'; message: string }
  | { type: 'RESET' };

export const initialMatchmakingState: MatchmakingState = { status: 'idle' };

export const MATCHMAKING_NOTICES = {
  leftQueue: 'Você saiu da fila.',
  cancelledRequeued: 'A partida foi cancelada — você voltou para a fila.',
  cancelledRemoved: 'A partida foi cancelada.',
} as const;

function resolveMatchEndState(
  state: Extract<MatchmakingState, { status: 'matched' }>,
): MatchmakingState {
  if (state.leaveRequested) {
    return { status: 'idle', notice: MATCHMAKING_NOTICES.cancelledRemoved };
  }
  if (state.accepted) {
    return { status: 'queueing', notice: MATCHMAKING_NOTICES.cancelledRequeued };
  }
  return { status: 'idle', notice: MATCHMAKING_NOTICES.cancelledRemoved };
}

export function reduceMatchmakingState(
  state: MatchmakingState,
  action: MatchmakingAction,
): MatchmakingState {
  if (action.type === 'WS_EXCEPTION') {
    return state.status === 'redirecting' ? state : { status: 'error', message: action.message };
  }

  switch (state.status) {
    case 'idle':
      if (action.type === 'JOIN_REQUESTED') {
        return { status: 'queueing' };
      }
      return state;

    case 'queueing':
      if (action.type === 'LEAVE_REQUESTED') {
        return { status: 'idle', notice: MATCHMAKING_NOTICES.leftQueue };
      }
      if (action.type === 'QUEUE_MATCHED') {
        return {
          status: 'matched',
          matchId: action.payload.matchId,
          opponentId: action.payload.opponentId,
          matchedAt: action.payload.matchedAt,
          accepted: false,
          leaveRequested: false,
        };
      }
      return state;

    case 'matched':
      if (action.type === 'ACCEPT_REQUESTED') {
        if (state.accepted || state.leaveRequested) return state;
        return { ...state, accepted: true };
      }
      if (action.type === 'LEAVE_REQUESTED') {
        if (state.leaveRequested) return state;
        return { ...state, leaveRequested: true };
      }
      if (action.type === 'MATCH_START') {
        if (action.payload.matchId !== state.matchId) return state;
        return { status: 'redirecting', matchId: action.payload.matchId };
      }
      if (action.type === 'MATCH_END') {
        if (action.payload.matchId !== state.matchId) return state;
        return resolveMatchEndState(state);
      }
      return state;

    case 'redirecting':
      return state;

    case 'error':
      if (action.type === 'RESET') {
        return { status: 'idle' };
      }
      if (action.type === 'JOIN_REQUESTED') {
        return { status: 'queueing' };
      }
      return state;

    default:
      return state;
  }
}

export function parseWsExceptionMessage(raw: unknown): string {
  if (
    raw &&
    typeof raw === 'object' &&
    'message' in raw &&
    typeof (raw as { message: unknown }).message === 'string'
  ) {
    return (raw as { message: string }).message;
  }
  return 'Erro inesperado no matchmaking. Tente novamente.';
}
