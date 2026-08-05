import type { MatchResultPayload, MatchScoreTickPayload } from "@aurafarming/shared";
import { describe, expect, it } from "vitest";

import { initialMatchRoomState, reduceMatchRoomState, type MatchRoomState } from "../../src/lib/match-room-reducer.js";

const SELF = "8f14e45f-ceea-467e-adc6-11a75d3f8e1a";
const OPPONENT = "9f14e45f-ceea-467e-adc6-11a75d3f8e1b";
const MATCH_ID = "1f14e45f-ceea-467e-adc6-11a75d3f8e1c";

function scoreTick(selfScore: number, opponentScore: number): MatchScoreTickPayload {
  return {
    matchId: MATCH_ID,
    tickAt: "2026-01-01T00:00:05.000Z",
    scores: [
      { userId: SELF, liveScore: selfScore },
      { userId: OPPONENT, liveScore: opponentScore },
    ],
  };
}

function matchResult(winnerId: string | null): MatchResultPayload {
  const score = { overall: 0.7, breakdown: { posture: 0.7, eyeContact: 0.7, expression: 0.7, presence: 0.7, movement: 0.7 }, version: "aura-score-v1" as const, computedAt: "2026-01-01T00:01:00.000Z" };
  return {
    id: "res-1",
    matchId: MATCH_ID,
    player1: { userId: SELF, score, ratingDelta: 12 },
    player2: { userId: OPPONENT, score, ratingDelta: -12 },
    winnerId,
    createdAt: "2026-01-01T00:01:00.000Z",
  };
}

const liveState: MatchRoomState = { status: "live", scores: null, pendingChallenge: null };

describe("reduceMatchRoomState", () => {
  it("connecting -> live em CONNECTED", () => {
    const next = reduceMatchRoomState(initialMatchRoomState, { type: "CONNECTED" });
    expect(next).toEqual({ status: "live", scores: null, pendingChallenge: null });
  });

  it("connecting -> error em CONNECTION_FAILED", () => {
    const next = reduceMatchRoomState(initialMatchRoomState, { type: "CONNECTION_FAILED", kind: "not-active" });
    expect(next).toEqual({ status: "error", kind: "not-active", message: undefined });
  });

  it("ignora ações irrelevantes em connecting", () => {
    const next = reduceMatchRoomState(initialMatchRoomState, { type: "RESULT_TIMEOUT" });
    expect(next).toBe(initialMatchRoomState);
  });

  it("SCORE_TICK atribui self/opponent pelo userId, não pela posição no array", () => {
    const next = reduceMatchRoomState(liveState, { type: "SCORE_TICK", payload: scoreTick(0.4, 0.9), selfUserId: SELF });
    expect(next).toMatchObject({ status: "live", scores: { self: 0.4, opponent: 0.9 } });
  });

  it("mantém o último score válido se um SCORE_TICK não contiver o próprio userId", () => {
    const withScores: MatchRoomState = { status: "live", scores: { self: 0.4, opponent: 0.9, opponentId: OPPONENT }, pendingChallenge: null };
    const badTick: MatchScoreTickPayload = {
      matchId: MATCH_ID,
      tickAt: "2026-01-01T00:00:10.000Z",
      scores: [
        { userId: "outro-1", liveScore: 0.1 },
        { userId: "outro-2", liveScore: 0.2 },
      ],
    };
    const next = reduceMatchRoomState(withScores, { type: "SCORE_TICK", payload: badTick, selfUserId: SELF });
    expect(next).toMatchObject({ scores: { self: 0.4, opponent: 0.9 } });
  });

  it("VERIFY_CHALLENGE_RECEIVED marca um challenge pendente", () => {
    const next = reduceMatchRoomState(liveState, {
      type: "VERIFY_CHALLENGE_RECEIVED",
      payload: {
        matchId: MATCH_ID,
        userId: SELF,
        challengeId: "chal-1",
        challengeType: "snapshot",
        nonce: "n".repeat(16),
        issuedAt: "2026-01-01T00:00:05.000Z",
        expiresAt: "2026-01-01T00:00:35.000Z",
      },
    });
    expect(next).toMatchObject({ pendingChallenge: { challengeId: "chal-1" } });
  });

  it("VERIFY_CHALLENGE_ANSWERED limpa o challenge pendente só se o id bater", () => {
    const withChallenge: MatchRoomState = {
      status: "live",
      scores: null,
      pendingChallenge: { challengeId: "chal-1", expiresAt: "2026-01-01T00:00:35.000Z" },
    };
    const wrongId = reduceMatchRoomState(withChallenge, { type: "VERIFY_CHALLENGE_ANSWERED", challengeId: "chal-2" });
    expect(wrongId).toBe(withChallenge);

    const rightId = reduceMatchRoomState(withChallenge, { type: "VERIFY_CHALLENGE_ANSWERED", challengeId: "chal-1" });
    expect(rightId).toMatchObject({ pendingChallenge: null });
  });

  it("MATCH_END com reason completed vai para ended-awaiting-result", () => {
    const next = reduceMatchRoomState(liveState, {
      type: "MATCH_END",
      payload: { matchId: MATCH_ID, endedAt: "2026-01-01T00:02:00.000Z", reason: "completed" },
    });
    expect(next).toEqual({ status: "ended-awaiting-result", endedAt: "2026-01-01T00:02:00.000Z" });
  });

  it.each(["disconnected", "cancelled"] as const)("MATCH_END com reason %s vai para ended-no-result", (reason) => {
    const next = reduceMatchRoomState(liveState, {
      type: "MATCH_END",
      payload: { matchId: MATCH_ID, endedAt: "2026-01-01T00:02:00.000Z", reason },
    });
    expect(next).toEqual({ status: "ended-no-result", endedAt: "2026-01-01T00:02:00.000Z", reason });
  });

  it("ended-awaiting-result -> result em MATCH_RESULT", () => {
    const awaiting: MatchRoomState = { status: "ended-awaiting-result", endedAt: "2026-01-01T00:02:00.000Z" };
    const result = matchResult(SELF);
    const next = reduceMatchRoomState(awaiting, { type: "MATCH_RESULT", payload: result });
    expect(next).toEqual({ status: "result", result });
  });

  it("ended-awaiting-result -> error(timeout) em RESULT_TIMEOUT", () => {
    const awaiting: MatchRoomState = { status: "ended-awaiting-result", endedAt: "2026-01-01T00:02:00.000Z" };
    const next = reduceMatchRoomState(awaiting, { type: "RESULT_TIMEOUT" });
    expect(next).toEqual({ status: "error", kind: "timeout" });
  });

  it("estados terminais (ended-no-result, result, error) ignoram qualquer ação", () => {
    const terminals: MatchRoomState[] = [
      { status: "ended-no-result", endedAt: "2026-01-01T00:02:00.000Z", reason: "disconnected" },
      { status: "result", result: matchResult(null) },
      { status: "error", kind: "timeout" },
    ];
    for (const terminal of terminals) {
      expect(reduceMatchRoomState(terminal, { type: "CONNECTED" })).toBe(terminal);
    }
  });
});
