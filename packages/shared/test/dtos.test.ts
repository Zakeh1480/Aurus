import { describe, expect, it } from "vitest";

import { AuraFeaturesSchema } from "../src/dtos/aura-features.dto.js";
import { AuraScoreSchema } from "../src/dtos/aura-score.dto.js";
import { MatchResultSchema } from "../src/dtos/match-result.dto.js";
import { MatchSchema } from "../src/dtos/match.dto.js";
import { ProfileSchema } from "../src/dtos/profile.dto.js";
import { RankingEntrySchema } from "../src/dtos/ranking-entry.dto.js";
import { UserSchema } from "../src/dtos/user.dto.js";

const UUID_A = "123e4567-e89b-12d3-a456-426614174000";
const UUID_B = "223e4567-e89b-12d3-a456-426614174001";
const NOW = new Date().toISOString();

describe("UserSchema", () => {
  it("aceita um usuário válido", () => {
    const result = UserSchema.safeParse({
      id: UUID_A,
      email: "player@example.com",
      displayName: "Player One",
      avatarUrl: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita email inválido", () => {
    const result = UserSchema.safeParse({
      id: UUID_A,
      email: "not-an-email",
      displayName: "Player One",
      avatarUrl: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(false);
  });
});

describe("ProfileSchema", () => {
  it("aceita um profile válido", () => {
    const result = ProfileSchema.safeParse({
      userId: UUID_A,
      rating: 1000,
      auraScoreAvg: null,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita rating negativo", () => {
    const result = ProfileSchema.safeParse({
      userId: UUID_A,
      rating: -1,
      auraScoreAvg: null,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(false);
  });
});

describe("MatchSchema", () => {
  it("aceita um match válido", () => {
    const result = MatchSchema.safeParse({
      id: UUID_A,
      player1Id: UUID_A,
      player2Id: UUID_B,
      status: "pending",
      startedAt: null,
      endedAt: null,
      createdAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita status fora do enum", () => {
    const result = MatchSchema.safeParse({
      id: UUID_A,
      player1Id: UUID_A,
      player2Id: UUID_B,
      status: "invalid-status",
      startedAt: null,
      endedAt: null,
      createdAt: NOW,
    });
    expect(result.success).toBe(false);
  });
});

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

describe("MatchResultSchema", () => {
  it("aceita um resultado válido", () => {
    const result = MatchResultSchema.safeParse({
      id: UUID_A,
      matchId: UUID_A,
      player1: { userId: UUID_A, score: VALID_AURA_SCORE },
      player2: { userId: UUID_B, score: VALID_AURA_SCORE },
      winnerId: UUID_A,
      createdAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("aceita winnerId nulo (empate)", () => {
    const result = MatchResultSchema.safeParse({
      id: UUID_A,
      matchId: UUID_A,
      player1: { userId: UUID_A, score: VALID_AURA_SCORE },
      player2: { userId: UUID_B, score: VALID_AURA_SCORE },
      winnerId: null,
      createdAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita quando falta o player2", () => {
    const result = MatchResultSchema.safeParse({
      id: UUID_A,
      matchId: UUID_A,
      player1: { userId: UUID_A, score: VALID_AURA_SCORE },
      winnerId: null,
      createdAt: NOW,
    });
    expect(result.success).toBe(false);
  });
});

describe("RankingEntrySchema", () => {
  it("aceita uma entrada de ranking válida", () => {
    const result = RankingEntrySchema.safeParse({
      rank: 1,
      userId: UUID_A,
      displayName: "Player One",
      rating: 1200,
      auraScoreAvg: 0.75,
      matchesPlayed: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita rank não positivo", () => {
    const result = RankingEntrySchema.safeParse({
      rank: 0,
      userId: UUID_A,
      displayName: "Player One",
      rating: 1200,
      auraScoreAvg: 0.75,
      matchesPlayed: 10,
    });
    expect(result.success).toBe(false);
  });
});

describe("AuraFeaturesSchema", () => {
  const base = {
    posture: 0.5,
    eyeContact: 0.5,
    expression: 0.5,
    presence: 0.5,
    movement: 0.5,
    sequence: 0,
    capturedAt: NOW,
  };

  it("aceita métricas no limite inferior (0) e superior (1)", () => {
    expect(AuraFeaturesSchema.safeParse({ ...base, posture: 0 }).success).toBe(true);
    expect(AuraFeaturesSchema.safeParse({ ...base, posture: 1 }).success).toBe(true);
  });

  it("rejeita métricas fora do intervalo 0–1", () => {
    expect(AuraFeaturesSchema.safeParse({ ...base, posture: -0.0001 }).success).toBe(false);
    expect(AuraFeaturesSchema.safeParse({ ...base, posture: 1.0001 }).success).toBe(false);
  });
});

describe("AuraScoreSchema", () => {
  it("aceita um score válido carimbado com AURA_SCORE_VERSION", () => {
    expect(AuraScoreSchema.safeParse(VALID_AURA_SCORE).success).toBe(true);
  });

  it("rejeita qualquer version diferente do literal aura-score-v1", () => {
    const result = AuraScoreSchema.safeParse({ ...VALID_AURA_SCORE, version: "aura-score-v2" });
    expect(result.success).toBe(false);
  });
});
