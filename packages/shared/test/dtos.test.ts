import { describe, expect, it } from "vitest";

import {
  AntiCheatIncidentSchema,
  LivenessFlagCountsSchema,
  MatchTrustDecisionSchema,
  TrustAssessmentSchema,
} from "../src/dtos/anti-cheat.dto.js";
import { AntiCheatSessionSecretResponseSchema } from "../src/dtos/anti-cheat-session.dto.js";
import { AuraFeaturesSchema } from "../src/dtos/aura-features.dto.js";
import { AuraScoreSchema } from "../src/dtos/aura-score.dto.js";
import {
  AuthResponseSchema,
  AuthTokensSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
} from "../src/dtos/auth.dto.js";
import { ConsentSchema, ConsentStatusSchema, GrantConsentRequestSchema } from "../src/dtos/consent.dto.js";
import { LivekitTokenResponseSchema } from "../src/dtos/livekit-token.dto.js";
import { MatchResultSchema } from "../src/dtos/match-result.dto.js";
import { MatchSchema } from "../src/dtos/match.dto.js";
import { ProfileSchema, UpdateProfileRequestSchema } from "../src/dtos/profile.dto.js";
import { RankingEntrySchema } from "../src/dtos/ranking-entry.dto.js";
import { MatchHistoryEntrySchema, UserDataExportSchema } from "../src/dtos/user-data-export.dto.js";
import { UserSchema } from "../src/dtos/user.dto.js";
import { LivenessFlagsSchema, VerifyRequestSchema, VerifyResponseSchema } from "../src/dtos/verify.dto.js";

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

describe("RegisterRequestSchema", () => {
  it("aceita um registro válido", () => {
    const result = RegisterRequestSchema.safeParse({
      email: "player@example.com",
      password: "senha-forte-123",
      displayName: "Player One",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita senha menor que 8 caracteres", () => {
    const result = RegisterRequestSchema.safeParse({
      email: "player@example.com",
      password: "short",
      displayName: "Player One",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita email inválido", () => {
    const result = RegisterRequestSchema.safeParse({
      email: "not-an-email",
      password: "senha-forte-123",
      displayName: "Player One",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita displayName vazio", () => {
    const result = RegisterRequestSchema.safeParse({
      email: "player@example.com",
      password: "senha-forte-123",
      displayName: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("LoginRequestSchema", () => {
  it("aceita um login válido", () => {
    const result = LoginRequestSchema.safeParse({
      email: "player@example.com",
      password: "qualquer-senha",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita senha vazia", () => {
    const result = LoginRequestSchema.safeParse({
      email: "player@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita email inválido", () => {
    const result = LoginRequestSchema.safeParse({
      email: "not-an-email",
      password: "qualquer-senha",
    });
    expect(result.success).toBe(false);
  });
});

describe("AuthTokensSchema", () => {
  it("aceita tokens válidos", () => {
    const result = AuthTokensSchema.safeParse({
      accessToken: "jwt.token.value",
      expiresIn: 900,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita expiresIn não positivo", () => {
    const result = AuthTokensSchema.safeParse({
      accessToken: "jwt.token.value",
      expiresIn: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita expiresIn fracionário", () => {
    const result = AuthTokensSchema.safeParse({
      accessToken: "jwt.token.value",
      expiresIn: 900.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("AuthResponseSchema", () => {
  const validUser = {
    id: UUID_A,
    email: "player@example.com",
    displayName: "Player One",
    avatarUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
  };

  it("aceita uma resposta de auth válida", () => {
    const result = AuthResponseSchema.safeParse({
      user: validUser,
      tokens: { accessToken: "jwt.token.value", expiresIn: 900 },
    });
    expect(result.success).toBe(true);
  });

  it("rejeita quando falta tokens", () => {
    const result = AuthResponseSchema.safeParse({ user: validUser });
    expect(result.success).toBe(false);
  });
});

describe("ProfileSchema", () => {
  it("aceita um profile válido", () => {
    const result = ProfileSchema.safeParse({
      userId: UUID_A,
      nickname: "PlayerOne",
      avatarUrl: null,
      bio: null,
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
      nickname: "PlayerOne",
      avatarUrl: null,
      bio: null,
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

  it("rejeita nickname vazio", () => {
    const result = ProfileSchema.safeParse({
      userId: UUID_A,
      nickname: "",
      avatarUrl: null,
      bio: null,
      rating: 1000,
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

describe("UpdateProfileRequestSchema", () => {
  it("aceita atualização parcial de um único campo", () => {
    expect(UpdateProfileRequestSchema.safeParse({ nickname: "NovoNick" }).success).toBe(true);
  });

  it("aceita bio/avatarUrl nulos explicitamente", () => {
    expect(UpdateProfileRequestSchema.safeParse({ bio: null, avatarUrl: null }).success).toBe(true);
  });

  it("rejeita payload vazio", () => {
    expect(UpdateProfileRequestSchema.safeParse({}).success).toBe(false);
  });

  it("rejeita nickname vazio", () => {
    expect(UpdateProfileRequestSchema.safeParse({ nickname: "" }).success).toBe(false);
  });

  it("descarta campos desconhecidos como userId — não dá pra injetar outro titular pelo payload", () => {
    const result = UpdateProfileRequestSchema.safeParse({ nickname: "X", userId: "outro-usuario" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("userId");
    }
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

describe("LivekitTokenResponseSchema", () => {
  it("aceita uma resposta de token válida", () => {
    const result = LivekitTokenResponseSchema.safeParse({
      token: "jwt.livekit.token",
      url: "wss://aurafarming.livekit.cloud",
      roomName: UUID_A,
      identity: UUID_B,
      expiresAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita identity que não é uuid", () => {
    const result = LivekitTokenResponseSchema.safeParse({
      token: "jwt.livekit.token",
      url: "wss://aurafarming.livekit.cloud",
      roomName: UUID_A,
      identity: "não-é-uuid",
      expiresAt: NOW,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita expiresAt fora do formato ISO", () => {
    const result = LivekitTokenResponseSchema.safeParse({
      token: "jwt.livekit.token",
      url: "wss://aurafarming.livekit.cloud",
      roomName: UUID_A,
      identity: UUID_B,
      expiresAt: "amanhã",
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
      player1: { userId: UUID_A, score: VALID_AURA_SCORE, ratingDelta: 12 },
      player2: { userId: UUID_B, score: VALID_AURA_SCORE, ratingDelta: -12 },
      winnerId: UUID_A,
      createdAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("aceita winnerId nulo (empate)", () => {
    const result = MatchResultSchema.safeParse({
      id: UUID_A,
      matchId: UUID_A,
      player1: { userId: UUID_A, score: VALID_AURA_SCORE, ratingDelta: 0 },
      player2: { userId: UUID_B, score: VALID_AURA_SCORE, ratingDelta: 0 },
      winnerId: null,
      createdAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita quando falta o player2", () => {
    const result = MatchResultSchema.safeParse({
      id: UUID_A,
      matchId: UUID_A,
      player1: { userId: UUID_A, score: VALID_AURA_SCORE, ratingDelta: 12 },
      winnerId: null,
      createdAt: NOW,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita ratingDelta não inteiro", () => {
    const result = MatchResultSchema.safeParse({
      id: UUID_A,
      matchId: UUID_A,
      player1: { userId: UUID_A, score: VALID_AURA_SCORE, ratingDelta: 12.5 },
      player2: { userId: UUID_B, score: VALID_AURA_SCORE, ratingDelta: -12 },
      winnerId: UUID_A,
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

describe("ConsentSchema", () => {
  it("aceita um consentimento válido", () => {
    const result = ConsentSchema.safeParse({
      id: UUID_A,
      userId: UUID_B,
      type: "camera",
      termsVersion: "v1",
      grantedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita type fora do enum", () => {
    const result = ConsentSchema.safeParse({
      id: UUID_A,
      userId: UUID_B,
      type: "microphone",
      termsVersion: "v1",
      grantedAt: NOW,
    });
    expect(result.success).toBe(false);
  });
});

describe("GrantConsentRequestSchema", () => {
  it("aceita um pedido de consentimento válido", () => {
    expect(GrantConsentRequestSchema.safeParse({ type: "camera", termsVersion: "v1" }).success).toBe(true);
  });

  it("rejeita termsVersion vazio", () => {
    expect(GrantConsentRequestSchema.safeParse({ type: "camera", termsVersion: "" }).success).toBe(false);
  });
});

describe("ConsentStatusSchema", () => {
  it("aceita status concedido", () => {
    const result = ConsentStatusSchema.safeParse({
      type: "camera",
      granted: true,
      termsVersion: "v1",
      grantedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("aceita status não concedido (nulos)", () => {
    const result = ConsentStatusSchema.safeParse({
      type: "camera",
      granted: false,
      termsVersion: null,
      grantedAt: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("MatchHistoryEntrySchema", () => {
  it("aceita uma entrada de histórico válida", () => {
    const result = MatchHistoryEntrySchema.safeParse({
      matchId: UUID_A,
      side: "player1",
      status: "completed",
      ratingBefore: 1000,
      ratingAfter: 1012,
      startedAt: NOW,
      endedAt: NOW,
      createdAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita side fora do enum", () => {
    const result = MatchHistoryEntrySchema.safeParse({
      matchId: UUID_A,
      side: "player3",
      status: "completed",
      ratingBefore: 1000,
      ratingAfter: 1012,
      startedAt: NOW,
      endedAt: NOW,
      createdAt: NOW,
    });
    expect(result.success).toBe(false);
  });

  it("aceita ratingAfter nulo (partida ainda não terminou)", () => {
    const result = MatchHistoryEntrySchema.safeParse({
      matchId: UUID_A,
      side: "player1",
      status: "pending",
      ratingBefore: 1000,
      ratingAfter: null,
      startedAt: null,
      endedAt: null,
      createdAt: NOW,
    });
    expect(result.success).toBe(true);
  });
});

describe("UserDataExportSchema", () => {
  const validUser = {
    id: UUID_A,
    email: "player@example.com",
    displayName: "Player One",
    avatarUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const validProfile = {
    userId: UUID_A,
    nickname: "PlayerOne",
    avatarUrl: null,
    bio: null,
    rating: 1000,
    auraScoreAvg: null,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };

  it("aceita um export completo", () => {
    const result = UserDataExportSchema.safeParse({
      user: validUser,
      profile: validProfile,
      consents: [{ id: UUID_A, userId: UUID_A, type: "camera", termsVersion: "v1", grantedAt: NOW }],
      matchHistory: [],
      exportedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("aceita profile nulo (perfil ainda não criado)", () => {
    const result = UserDataExportSchema.safeParse({
      user: validUser,
      profile: null,
      consents: [],
      matchHistory: [],
      exportedAt: NOW,
    });
    expect(result.success).toBe(true);
  });
});

describe("AntiCheatSessionSecretResponseSchema", () => {
  it("aceita uma resposta válida", () => {
    const result = AntiCheatSessionSecretResponseSchema.safeParse({
      matchId: UUID_A,
      userId: UUID_B,
      sessionSecret: "s".repeat(32),
      expiresAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita sessionSecret menor que 32 caracteres", () => {
    const result = AntiCheatSessionSecretResponseSchema.safeParse({
      matchId: UUID_A,
      userId: UUID_B,
      sessionSecret: "curto",
      expiresAt: NOW,
    });
    expect(result.success).toBe(false);
  });
});

const VALID_CLAIMED_FEATURES = {
  posture: 0.5,
  eyeContact: 0.5,
  expression: 0.5,
  presence: 0.5,
  movement: 0.5,
  sequence: 0,
  capturedAt: NOW,
};

describe("VerifyRequestSchema", () => {
  it("aceita uma requisição válida", () => {
    const result = VerifyRequestSchema.safeParse({
      matchId: UUID_A,
      userId: UUID_B,
      challengeId: UUID_A,
      keyframeBase64: "ZmFrZS1rZXlmcmFtZQ==",
      claimedFeatures: VALID_CLAIMED_FEATURES,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita keyframeBase64 vazio", () => {
    const result = VerifyRequestSchema.safeParse({
      matchId: UUID_A,
      userId: UUID_B,
      challengeId: UUID_A,
      keyframeBase64: "",
      claimedFeatures: VALID_CLAIMED_FEATURES,
    });
    expect(result.success).toBe(false);
  });
});

describe("LivenessFlagsSchema", () => {
  it("aceita todas as flags", () => {
    const result = LivenessFlagsSchema.safeParse({
      noFaceDetected: false,
      staticImageSuspected: true,
      lowDetailSuspected: false,
      multipleFacesDetected: false,
    });
    expect(result.success).toBe(true);
  });
});

describe("VerifyResponseSchema", () => {
  const validLiveness = {
    noFaceDetected: false,
    staticImageSuspected: false,
    lowDetailSuspected: false,
    multipleFacesDetected: false,
  };

  it("aceita uma resposta válida", () => {
    const result = VerifyResponseSchema.safeParse({
      matchId: UUID_A,
      userId: UUID_B,
      challengeId: UUID_A,
      discrepancy: 0.1,
      discrepancyConfidence: 1.0,
      liveness: validLiveness,
      version: "anti-cheat-v1",
      computedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita discrepancy maior que 1", () => {
    const result = VerifyResponseSchema.safeParse({
      matchId: UUID_A,
      userId: UUID_B,
      challengeId: UUID_A,
      discrepancy: 1.5,
      discrepancyConfidence: 1.0,
      liveness: validLiveness,
      version: "anti-cheat-v1",
      computedAt: NOW,
    });
    expect(result.success).toBe(false);
  });
});

describe("LivenessFlagCountsSchema x LivenessFlagsSchema (guarda contra drift)", () => {
  it("toda flag de LivenessFlagsSchema tem uma contagem correspondente em LivenessFlagCountsSchema", () => {
    const flagKeys = Object.keys(LivenessFlagsSchema.shape);
    const countKeys = Object.keys(LivenessFlagCountsSchema.shape);
    const expectedCountKeys = flagKeys.map((key) => `${key}Count`);
    expect(expectedCountKeys.every((key) => countKeys.includes(key))).toBe(true);
    expect(countKeys.filter((key) => !expectedCountKeys.includes(key))).toEqual(["duplicateKeyframeCount"]);
  });
});

describe("TrustAssessmentSchema", () => {
  const validLivenessFlagCounts = {
    noFaceDetectedCount: 0,
    staticImageSuspectedCount: 0,
    lowDetailSuspectedCount: 0,
    multipleFacesDetectedCount: 0,
    duplicateKeyframeCount: 0,
  };

  it("aceita uma avaliação válida", () => {
    const result = TrustAssessmentSchema.safeParse({
      matchId: UUID_A,
      userId: UUID_B,
      trustScore: 0.9,
      trustLevel: "high",
      decision: "valid",
      discrepancyAvg: 0.05,
      livenessFlagCounts: validLivenessFlagCounts,
      rejectedPacketRatio: 0,
      temporalViolationCount: 0,
      challengesIssued: 3,
      challengesAnswered: 3,
      version: "anti-cheat-v1",
      evaluatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("aceita discrepancyAvg nulo (nenhum /verify concluído)", () => {
    const result = TrustAssessmentSchema.safeParse({
      matchId: UUID_A,
      userId: UUID_B,
      trustScore: 0.5,
      trustLevel: "medium",
      decision: "flagged",
      discrepancyAvg: null,
      livenessFlagCounts: validLivenessFlagCounts,
      rejectedPacketRatio: 0,
      temporalViolationCount: 0,
      challengesIssued: 2,
      challengesAnswered: 0,
      version: "anti-cheat-v1",
      evaluatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita trustLevel fora do enum", () => {
    const result = TrustAssessmentSchema.safeParse({
      matchId: UUID_A,
      userId: UUID_B,
      trustScore: 0.9,
      trustLevel: "critical",
      decision: "valid",
      discrepancyAvg: 0.05,
      livenessFlagCounts: validLivenessFlagCounts,
      rejectedPacketRatio: 0,
      temporalViolationCount: 0,
      challengesIssued: 3,
      challengesAnswered: 3,
      version: "anti-cheat-v1",
      evaluatedAt: NOW,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita trustScore maior que 1", () => {
    const result = TrustAssessmentSchema.safeParse({
      matchId: UUID_A,
      userId: UUID_B,
      trustScore: 1.5,
      trustLevel: "high",
      decision: "valid",
      discrepancyAvg: 0.05,
      livenessFlagCounts: validLivenessFlagCounts,
      rejectedPacketRatio: 0,
      temporalViolationCount: 0,
      challengesIssued: 3,
      challengesAnswered: 3,
      version: "anti-cheat-v1",
      evaluatedAt: NOW,
    });
    expect(result.success).toBe(false);
  });
});

describe("MatchTrustDecisionSchema", () => {
  const validAssessment = {
    matchId: UUID_A,
    userId: UUID_B,
    trustScore: 0.9,
    trustLevel: "high" as const,
    decision: "valid" as const,
    discrepancyAvg: 0.05,
    livenessFlagCounts: {
      noFaceDetectedCount: 0,
      staticImageSuspectedCount: 0,
      lowDetailSuspectedCount: 0,
      multipleFacesDetectedCount: 0,
      duplicateKeyframeCount: 0,
    },
    rejectedPacketRatio: 0,
    temporalViolationCount: 0,
    challengesIssued: 3,
    challengesAnswered: 3,
    version: "anti-cheat-v1" as const,
    evaluatedAt: NOW,
  };

  it("aceita uma decisão válida", () => {
    const result = MatchTrustDecisionSchema.safeParse({
      matchId: UUID_A,
      player1: validAssessment,
      player2: { ...validAssessment, userId: UUID_A },
      overallDecision: "valid",
      evaluatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });
});

describe("AntiCheatIncidentSchema", () => {
  it("aceita um incidente válido", () => {
    const result = AntiCheatIncidentSchema.safeParse({
      id: UUID_A,
      matchId: UUID_A,
      userId: UUID_B,
      decision: "discarded",
      trustLevel: "low",
      trustScore: 0.1,
      discrepancyAvg: 0.8,
      rejectedPacketRatio: 0.5,
      temporalViolationCount: 4,
      challengesIssued: 3,
      challengesAnswered: 2,
      detail: { reason: "static image suspected" },
      version: "anti-cheat-v1",
      createdAt: NOW,
    });
    expect(result.success).toBe(true);
  });
});
