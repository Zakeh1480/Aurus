import type { MatchFeaturesPayload, MatchVerifyResponsePayload, VerifyResponse } from "@aurafarming/shared";
import { Test } from "@nestjs/testing";
import type { Socket } from "socket.io";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AiVerifyClientService } from "./ai-verify-client.service";
import { AntiCheatGateway } from "./anti-cheat.gateway";
import { FeatureBufferService } from "./feature-buffer.service";
import { buildFeaturesSigningPayload, buildVerifyResponseSigningPayload, signHmac } from "./hmac.util";
import { KeyframeHistoryService } from "./keyframe-history.service";
import { NonceService } from "./nonce.service";
import { SessionSecretService } from "./session-secret.service";
import { TrustScoreService } from "./trust-score.service";

const MATCH_ID = "match-1";
const USER_ID = "user-a";
const SECRET = "s".repeat(32);

function fakeSocket(userId: string): Socket {
  return { data: { userId } } as unknown as Socket;
}

function featuresPayload(overrides: Partial<MatchFeaturesPayload> = {}): MatchFeaturesPayload {
  const base = {
    matchId: MATCH_ID,
    userId: USER_ID,
    features: {
      posture: 0.5,
      eyeContact: 0.5,
      expression: 0.5,
      presence: 0.5,
      movement: 0.5,
      sequence: 0,
      capturedAt: new Date().toISOString(),
    },
    nonce: "n".repeat(16),
    signature: "",
  };
  const merged = { ...base, ...overrides };
  if (!overrides.signature) {
    merged.signature = signHmac(
      buildFeaturesSigningPayload({
        matchId: merged.matchId,
        userId: merged.userId,
        nonce: merged.nonce,
        sequence: merged.features.sequence,
        capturedAt: merged.features.capturedAt,
      }),
      SECRET,
    );
  }
  return merged;
}

function verifyResponsePayload(overrides: Partial<MatchVerifyResponsePayload> = {}): MatchVerifyResponsePayload {
  const base = {
    matchId: MATCH_ID,
    userId: USER_ID,
    challengeId: "challenge-1",
    nonce: "n".repeat(16),
    capturedAt: new Date().toISOString(),
    keyframeBase64: "ZmFrZS1rZXlmcmFtZQ==",
    claimedFeatures: {
      posture: 0.5,
      eyeContact: 0.5,
      expression: 0.5,
      presence: 0.5,
      movement: 0.5,
      sequence: 0,
      capturedAt: new Date().toISOString(),
    },
    signature: "",
  };
  const merged = { ...base, ...overrides };
  if (!overrides.signature) {
    merged.signature = signHmac(
      buildVerifyResponseSigningPayload({
        matchId: merged.matchId,
        userId: merged.userId,
        challengeId: merged.challengeId,
        nonce: merged.nonce,
        capturedAt: merged.capturedAt,
      }),
      SECRET,
    );
  }
  return merged;
}

describe("AntiCheatGateway", () => {
  let sessionSecretService: { get: ReturnType<typeof vi.fn> };
  let nonceService: { consumeFeatureNonce: ReturnType<typeof vi.fn>; consumeChallengeNonce: ReturnType<typeof vi.fn> };
  let featureBufferService: { pushAndCheck: ReturnType<typeof vi.fn> };
  let keyframeHistoryService: { checkAndRecord: ReturnType<typeof vi.fn> };
  let aiVerifyClient: { verify: ReturnType<typeof vi.fn> };
  let trustScoreService: {
    recordRejectedPacket: ReturnType<typeof vi.fn>;
    recordAcceptedPacket: ReturnType<typeof vi.fn>;
    recordRejectedChallenge: ReturnType<typeof vi.fn>;
    recordDuplicateKeyframe: ReturnType<typeof vi.fn>;
    recordVerifyResult: ReturnType<typeof vi.fn>;
    recordVerifyFailure: ReturnType<typeof vi.fn>;
  };
  let gateway: AntiCheatGateway;

  beforeEach(async () => {
    sessionSecretService = { get: vi.fn().mockResolvedValue(SECRET) };
    nonceService = {
      consumeFeatureNonce: vi.fn().mockResolvedValue(true),
      consumeChallengeNonce: vi.fn().mockResolvedValue(true),
    };
    featureBufferService = { pushAndCheck: vi.fn().mockResolvedValue({ violated: false }) };
    keyframeHistoryService = { checkAndRecord: vi.fn().mockResolvedValue(false) };
    aiVerifyClient = { verify: vi.fn() };
    trustScoreService = {
      recordRejectedPacket: vi.fn().mockResolvedValue(undefined),
      recordAcceptedPacket: vi.fn().mockResolvedValue(undefined),
      recordRejectedChallenge: vi.fn().mockResolvedValue(undefined),
      recordDuplicateKeyframe: vi.fn().mockResolvedValue(undefined),
      recordVerifyResult: vi.fn().mockResolvedValue(undefined),
      recordVerifyFailure: vi.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AntiCheatGateway,
        { provide: SessionSecretService, useValue: sessionSecretService },
        { provide: NonceService, useValue: nonceService },
        { provide: FeatureBufferService, useValue: featureBufferService },
        { provide: KeyframeHistoryService, useValue: keyframeHistoryService },
        { provide: AiVerifyClientService, useValue: aiVerifyClient },
        { provide: TrustScoreService, useValue: trustScoreService },
      ],
    }).compile();
    gateway = moduleRef.get(AntiCheatGateway);
  });

  describe("onFeatures", () => {
    it("aceita um pacote com assinatura válida, nonce novo e dentro da janela temporal", async () => {
      const payload = featuresPayload();
      await gateway.onFeatures(fakeSocket(USER_ID), payload);

      expect(featureBufferService.pushAndCheck).toHaveBeenCalledWith(MATCH_ID, USER_ID, payload.features);
      expect(trustScoreService.recordAcceptedPacket).toHaveBeenCalledWith(MATCH_ID, USER_ID, false);
      expect(trustScoreService.recordRejectedPacket).not.toHaveBeenCalled();
    });

    it("rejeita quando a assinatura foi feita com um segredo diferente (features forjadas por quem não tem a sessão)", async () => {
      const payload = featuresPayload({ signature: signHmac("payload-qualquer", "outro-segredo-1234567890123456") });
      await gateway.onFeatures(fakeSocket(USER_ID), payload);

      expect(featureBufferService.pushAndCheck).not.toHaveBeenCalled();
      expect(trustScoreService.recordRejectedPacket).toHaveBeenCalledWith(MATCH_ID, USER_ID);
    });

    it("rejeita replay — nonce já consumido", async () => {
      nonceService.consumeFeatureNonce.mockResolvedValue(false);
      const payload = featuresPayload();
      await gateway.onFeatures(fakeSocket(USER_ID), payload);

      expect(trustScoreService.recordRejectedPacket).toHaveBeenCalledWith(MATCH_ID, USER_ID);
    });

    it("rejeita pacote sem segredo de sessão emitido para o par match+user", async () => {
      sessionSecretService.get.mockResolvedValue(null);
      const payload = featuresPayload();
      await gateway.onFeatures(fakeSocket(USER_ID), payload);

      expect(trustScoreService.recordRejectedPacket).toHaveBeenCalledWith(MATCH_ID, USER_ID);
    });

    it("rejeita quando capturedAt está fora da janela de clock skew", async () => {
      const payload = featuresPayload({
        features: {
          posture: 0.5,
          eyeContact: 0.5,
          expression: 0.5,
          presence: 0.5,
          movement: 0.5,
          sequence: 0,
          capturedAt: new Date(Date.now() - 60_000).toISOString(),
        },
      });
      await gateway.onFeatures(fakeSocket(USER_ID), payload);

      expect(trustScoreService.recordRejectedPacket).toHaveBeenCalledWith(MATCH_ID, USER_ID);
    });
  });

  describe("onVerifyResponse", () => {
    const AI_RESPONSE: VerifyResponse = {
      matchId: MATCH_ID,
      userId: USER_ID,
      challengeId: "challenge-1",
      discrepancy: 0.05,
      discrepancyConfidence: 1.0,
      liveness: {
        noFaceDetected: false,
        staticImageSuspected: false,
        lowDetailSuspected: false,
        multipleFacesDetected: false,
      },
      version: "anti-cheat-v1",
      computedAt: "2026-01-01T00:00:00.000Z",
    };

    it("valida, encaminha ao serviço de IA e registra o resultado quando tudo está correto", async () => {
      aiVerifyClient.verify.mockResolvedValue(AI_RESPONSE);
      const payload = verifyResponsePayload();

      await gateway.onVerifyResponse(fakeSocket(USER_ID), payload);

      expect(aiVerifyClient.verify).toHaveBeenCalledWith({
        matchId: MATCH_ID,
        userId: USER_ID,
        challengeId: payload.challengeId,
        keyframeBase64: payload.keyframeBase64,
        claimedFeatures: payload.claimedFeatures,
      });
      expect(trustScoreService.recordVerifyResult).toHaveBeenCalledWith(MATCH_ID, USER_ID, AI_RESPONSE);
    });

    it("rejeita quando o nonce não bate com nenhum desafio emitido", async () => {
      nonceService.consumeChallengeNonce.mockResolvedValue(false);
      const payload = verifyResponsePayload();

      await gateway.onVerifyResponse(fakeSocket(USER_ID), payload);

      expect(aiVerifyClient.verify).not.toHaveBeenCalled();
      expect(trustScoreService.recordRejectedChallenge).toHaveBeenCalledWith(MATCH_ID, USER_ID);
    });

    it("rejeita quando a assinatura é inválida mesmo com nonce correto", async () => {
      const payload = verifyResponsePayload({ signature: signHmac("outro-payload", SECRET) });

      await gateway.onVerifyResponse(fakeSocket(USER_ID), payload);

      expect(aiVerifyClient.verify).not.toHaveBeenCalled();
      expect(trustScoreService.recordRejectedChallenge).toHaveBeenCalledWith(MATCH_ID, USER_ID);
    });

    it("registra keyframe duplicado quando o mesmo snapshot já foi visto na partida", async () => {
      keyframeHistoryService.checkAndRecord.mockResolvedValue(true);
      aiVerifyClient.verify.mockResolvedValue(AI_RESPONSE);
      const payload = verifyResponsePayload();

      await gateway.onVerifyResponse(fakeSocket(USER_ID), payload);

      expect(trustScoreService.recordDuplicateKeyframe).toHaveBeenCalledWith(MATCH_ID, USER_ID);
    });

    it("nunca relança quando o serviço de IA falha — registra a falha e segue", async () => {
      aiVerifyClient.verify.mockRejectedValue(new Error("timeout"));
      const payload = verifyResponsePayload();

      await expect(gateway.onVerifyResponse(fakeSocket(USER_ID), payload)).resolves.toBeUndefined();
      expect(trustScoreService.recordVerifyFailure).toHaveBeenCalledWith(MATCH_ID, USER_ID);
    });
  });
});
