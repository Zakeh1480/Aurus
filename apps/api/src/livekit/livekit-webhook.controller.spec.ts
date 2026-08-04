import { UnauthorizedException, type RawBodyRequest } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Request } from "express";
import type { WebhookEvent } from "livekit-server-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ScoringService } from "../scoring/scoring.service";
import { LivekitWebhookController } from "./livekit-webhook.controller";
import { LivekitService } from "./livekit.service";

function fakeRequest(rawBody?: Buffer): RawBodyRequest<Request> {
  return { rawBody } as unknown as RawBodyRequest<Request>;
}

describe("LivekitWebhookController", () => {
  let controller: LivekitWebhookController;
  let livekit: { verifyWebhook: ReturnType<typeof vi.fn>; deleteRoom: ReturnType<typeof vi.fn> };
  let scoringService: { finalizeMatch: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    livekit = { verifyWebhook: vi.fn(), deleteRoom: vi.fn().mockResolvedValue(undefined) };
    scoringService = { finalizeMatch: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [LivekitWebhookController],
      providers: [
        { provide: LivekitService, useValue: livekit },
        { provide: ScoringService, useValue: scoringService },
      ],
    }).compile();

    controller = moduleRef.get(LivekitWebhookController);
  });

  it("rejeita quando falta o header Authorization", async () => {
    await expect(
      controller.handleWebhook(fakeRequest(Buffer.from("{}")), undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(livekit.verifyWebhook).not.toHaveBeenCalled();
  });

  it("rejeita quando falta o rawBody", async () => {
    await expect(controller.handleWebhook(fakeRequest(undefined), "assinatura")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejeita quando a assinatura é inválida", async () => {
    livekit.verifyWebhook.mockRejectedValue(new Error("sha256 checksum of body does not match"));

    await expect(
      controller.handleWebhook(fakeRequest(Buffer.from("{}")), "assinatura-invalida"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(scoringService.finalizeMatch).not.toHaveBeenCalled();
  });

  it("participant_left válido finaliza a partida via ScoringService e apaga a room", async () => {
    livekit.verifyWebhook.mockResolvedValue({
      event: "participant_left",
      room: { name: "match-123" },
    } as WebhookEvent);

    const result = await controller.handleWebhook(fakeRequest(Buffer.from("{}")), "assinatura-valida");

    expect(scoringService.finalizeMatch).toHaveBeenCalledWith("match-123");
    expect(livekit.deleteRoom).toHaveBeenCalledWith("match-123");
    expect(result).toEqual({ received: true });
  });

  it("ignora eventos que não são participant_left, sem efeitos colaterais", async () => {
    livekit.verifyWebhook.mockResolvedValue({
      event: "room_started",
      room: { name: "match-123" },
    } as WebhookEvent);

    const result = await controller.handleWebhook(fakeRequest(Buffer.from("{}")), "assinatura-valida");

    expect(scoringService.finalizeMatch).not.toHaveBeenCalled();
    expect(livekit.deleteRoom).not.toHaveBeenCalled();
    expect(result).toEqual({ received: true });
  });
});
