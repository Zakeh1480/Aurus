import { createHash } from "node:crypto";

import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LivekitService } from "./livekit.service";

const API_KEY = "test-api-key";
const API_SECRET = "test-api-secret-that-is-long-enough";

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payloadSegment = token.split(".")[1];
  if (!payloadSegment) throw new Error("token sem payload");
  return JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
}

describe("LivekitService", () => {
  let service: LivekitService;

  beforeEach(() => {
    vi.stubEnv("LIVEKIT_URL", "wss://aurafarming.livekit.cloud");
    vi.stubEnv("LIVEKIT_API_KEY", API_KEY);
    vi.stubEnv("LIVEKIT_API_SECRET", API_SECRET);
    service = new LivekitService();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("createToken", () => {
    it("gera um JWT com identity e grant restritos à room informada", async () => {
      const { token, expiresAt } = await service.createToken("match-123", "user-a");

      const payload = decodeJwtPayload(token);
      expect(payload["sub"]).toBe("user-a");
      expect(payload["iss"]).toBe(API_KEY);
      expect(payload["video"]).toMatchObject({ room: "match-123", roomJoin: true });
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("verifyWebhook", () => {
    async function signWebhook(body: string): Promise<string> {
      const hash = createHash("sha256").update(body).digest("base64");
      const at = new AccessToken(API_KEY, API_SECRET, {});
      at.sha256 = hash;
      return at.toJwt();
    }

    it("aceita um payload assinado corretamente", async () => {
      const body = JSON.stringify({ event: "participant_left", room: { name: "match-123" } });
      const authHeader = await signWebhook(body);

      const event = await service.verifyWebhook(body, authHeader);

      expect(event.event).toBe("participant_left");
      expect(event.room?.name).toBe("match-123");
    });

    it("rejeita quando a assinatura foi feita com outro secret", async () => {
      const body = JSON.stringify({ event: "participant_left", room: { name: "match-123" } });
      const hash = createHash("sha256").update(body).digest("base64");
      const at = new AccessToken(API_KEY, "outro-secret-completamente-diferente", {});
      at.sha256 = hash;
      const authHeader = await at.toJwt();

      await expect(service.verifyWebhook(body, authHeader)).rejects.toThrow();
    });

    it("rejeita quando o corpo foi alterado após a assinatura", async () => {
      const originalBody = JSON.stringify({ event: "participant_left", room: { name: "match-123" } });
      const authHeader = await signWebhook(originalBody);
      const tamperedBody = JSON.stringify({ event: "participant_left", room: { name: "match-456" } });

      await expect(service.verifyWebhook(tamperedBody, authHeader)).rejects.toThrow();
    });
  });

  describe("ensureRoom / deleteRoom", () => {
    it("ensureRoom chama createRoom com o nome da room e é idempotente em erro", async () => {
      const createRoom = vi.spyOn(RoomServiceClient.prototype, "createRoom").mockResolvedValueOnce({} as never);
      await service.ensureRoom("match-123");
      expect(createRoom).toHaveBeenCalledWith(
        expect.objectContaining({ name: "match-123", maxParticipants: 2 }),
      );

      createRoom.mockRejectedValueOnce(new Error("room já existe"));
      await expect(service.ensureRoom("match-123")).resolves.toBeUndefined();
    });

    it("deleteRoom não lança quando a room já não existe", async () => {
      vi.spyOn(RoomServiceClient.prototype, "deleteRoom").mockRejectedValueOnce(new Error("not found"));
      await expect(service.deleteRoom("match-123")).resolves.toBeUndefined();
    });
  });
});
