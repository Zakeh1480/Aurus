import { describe, expect, it } from "vitest";

import { type WsEventName, WsEventSchemas } from "../src/events/event-map.js";

const UUID_A = "123e4567-e89b-12d3-a456-426614174000";
const UUID_B = "223e4567-e89b-12d3-a456-426614174001";
const NOW = new Date().toISOString();

const VALID_AURA_SCORE = {
  overall: 0.8,
  breakdown: {
    posture: 0.8,
    eyeContact: 0.8,
    expression: 0.8,
    presence: 0.8,
    movement: 0.8,
  },
  version: "aura-score-v1" as const,
  computedAt: NOW,
};

const VALID_FIXTURES: Record<WsEventName, unknown> = {
  "queue:join": { userId: UUID_A },
  "queue:leave": { userId: UUID_A },
  "queue:matched": {
    matchId: UUID_A,
    opponentId: UUID_B,
    queueStatus: "matched",
    matchedAt: NOW,
  },
  "match:start": {
    matchId: UUID_A,
    player1Id: UUID_A,
    player2Id: UUID_B,
    startedAt: NOW,
  },
  "match:features": {
    matchId: UUID_A,
    userId: UUID_A,
    features: {
      posture: 0.5,
      eyeContact: 0.5,
      expression: 0.5,
      presence: 0.5,
      movement: 0.5,
      sequence: 0,
      capturedAt: NOW,
    },
  },
  "match:score-tick": {
    matchId: UUID_A,
    tickAt: NOW,
    scores: [
      { userId: UUID_A, liveScore: 0.6 },
      { userId: UUID_B, liveScore: 0.7 },
    ],
  },
  "match:verify-challenge": {
    matchId: UUID_A,
    userId: UUID_A,
    challengeId: UUID_B,
    challengeType: "look-at-camera",
    issuedAt: NOW,
    expiresAt: NOW,
  },
  "match:end": {
    matchId: UUID_A,
    endedAt: NOW,
    reason: "completed",
  },
  "match:result": {
    id: UUID_A,
    matchId: UUID_A,
    player1: { userId: UUID_A, score: VALID_AURA_SCORE, ratingDelta: 12 },
    player2: { userId: UUID_B, score: VALID_AURA_SCORE, ratingDelta: -12 },
    winnerId: UUID_A,
    createdAt: NOW,
  },
};

describe("WsEventSchemas", () => {
  it.each(Object.entries(WsEventSchemas))("%s aceita seu payload válido", (eventName, schema) => {
    const fixture = VALID_FIXTURES[eventName as WsEventName];
    expect(schema.safeParse(fixture).success).toBe(true);
  });

  it("cobre exatamente os 9 eventos do contrato", () => {
    expect(Object.keys(WsEventSchemas).sort()).toEqual(
      [
        "queue:join",
        "queue:leave",
        "queue:matched",
        "match:start",
        "match:features",
        "match:score-tick",
        "match:verify-challenge",
        "match:end",
        "match:result",
      ].sort(),
    );
  });
});
