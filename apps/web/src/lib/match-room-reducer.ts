import type {
  MatchEndPayload,
  MatchResultPayload,
  MatchScoreTickPayload,
  MatchVerifyChallengePayload,
} from "@aurafarming/shared";

export type MatchRoomErrorKind =
  | "not-found"
  | "forbidden"
  | "not-active"
  | "permission-denied"
  | "connection-failed"
  | "timeout";

export type LiveScores = { self: number; opponent: number };

export type PendingChallenge = { challengeId: string; expiresAt: string };

export type MatchRoomState =
  | { status: "connecting" }
  | { status: "live"; scores: LiveScores | null; pendingChallenge: PendingChallenge | null }
  | { status: "ended-awaiting-result"; endedAt: string }
  | { status: "ended-no-result"; endedAt: string; reason: "disconnected" | "cancelled" }
  | { status: "result"; result: MatchResultPayload }
  | { status: "error"; kind: MatchRoomErrorKind; message?: string };

export type MatchRoomAction =
  | { type: "CONNECTED" }
  | { type: "CONNECTION_FAILED"; kind: MatchRoomErrorKind; message?: string }
  | { type: "SCORE_TICK"; payload: MatchScoreTickPayload; selfUserId: string }
  | { type: "VERIFY_CHALLENGE_RECEIVED"; payload: MatchVerifyChallengePayload }
  | { type: "VERIFY_CHALLENGE_ANSWERED"; challengeId: string }
  | { type: "MATCH_END"; payload: MatchEndPayload }
  | { type: "MATCH_RESULT"; payload: MatchResultPayload }
  | { type: "RESULT_TIMEOUT" };

export const initialMatchRoomState: MatchRoomState = { status: "connecting" };

function toLiveScores(payload: MatchScoreTickPayload, selfUserId: string): LiveScores | null {
  const self = payload.scores.find((entry) => entry.userId === selfUserId);
  const opponent = payload.scores.find((entry) => entry.userId !== selfUserId);
  if (!self || !opponent) return null;
  return { self: self.liveScore, opponent: opponent.liveScore };
}

/**
 * `matchId` já é conhecido como prop de quem chama (diferente do
 * matchmaking-reducer, onde o matchId nasce de um evento) — o filtro por
 * matchId nos eventos do socket acontece no hook chamador, não aqui.
 */
export function reduceMatchRoomState(state: MatchRoomState, action: MatchRoomAction): MatchRoomState {
  switch (state.status) {
    case "connecting":
      if (action.type === "CONNECTED") {
        return { status: "live", scores: null, pendingChallenge: null };
      }
      if (action.type === "CONNECTION_FAILED") {
        return { status: "error", kind: action.kind, message: action.message };
      }
      return state;

    case "live":
      if (action.type === "SCORE_TICK") {
        return { ...state, scores: toLiveScores(action.payload, action.selfUserId) ?? state.scores };
      }
      if (action.type === "VERIFY_CHALLENGE_RECEIVED") {
        return {
          ...state,
          pendingChallenge: { challengeId: action.payload.challengeId, expiresAt: action.payload.expiresAt },
        };
      }
      if (action.type === "VERIFY_CHALLENGE_ANSWERED") {
        if (state.pendingChallenge?.challengeId !== action.challengeId) return state;
        return { ...state, pendingChallenge: null };
      }
      if (action.type === "MATCH_END") {
        return action.payload.reason === "completed"
          ? { status: "ended-awaiting-result", endedAt: action.payload.endedAt }
          : { status: "ended-no-result", endedAt: action.payload.endedAt, reason: action.payload.reason };
      }
      // Ordem esperada é match:end -> match:result, mas aceitar match:result
      // direto também é inofensivo e mais robusto a uma reordenação de rede.
      if (action.type === "MATCH_RESULT") {
        return { status: "result", result: action.payload };
      }
      return state;

    case "ended-awaiting-result":
      if (action.type === "MATCH_RESULT") {
        return { status: "result", result: action.payload };
      }
      if (action.type === "RESULT_TIMEOUT") {
        return { status: "error", kind: "timeout" };
      }
      return state;

    case "ended-no-result":
    case "result":
    case "error":
      return state;

    default:
      return state;
  }
}
