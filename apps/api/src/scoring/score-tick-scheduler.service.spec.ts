import type { AuraFeatures, AuraScore } from "@aurafarming/shared";
import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MatchmakingService } from "../matchmaking/matchmaking.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiScoreClientService } from "./ai-score-client.service";
import { ScoreSampleBufferService } from "./score-sample-buffer.service";
import { ScoreTickSchedulerService } from "./score-tick-scheduler.service";

const FEATURES: AuraFeatures = {
  posture: 0.5,
  eyeContact: 0.5,
  expression: 0.5,
  presence: 0.5,
  movement: 0.5,
  sequence: 0,
  capturedAt: "2026-01-01T00:00:00.000Z",
};

const SCORE: AuraScore = {
  overall: 0.6,
  breakdown: { posture: 0.6, eyeContact: 0.6, expression: 0.6, presence: 0.6, movement: 0.6 },
  version: "aura-score-v1",
  computedAt: "2026-01-01T00:00:00.000Z",
};

describe("ScoreTickSchedulerService", () => {
  let prisma: { match: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } };
  let sampleBuffer: { readLatest: ReturnType<typeof vi.fn> };
  let aiScoreClient: { score: ReturnType<typeof vi.fn> };
  let matchmakingService: { emitToUser: ReturnType<typeof vi.fn> };
  let service: ScoreTickSchedulerService;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubEnv("MATCH_SCORE_TICK_INTERVAL_MS", "1000");

    prisma = {
      match: {
        findUnique: vi.fn().mockResolvedValue({ id: "match-1", status: "active" }),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };
    sampleBuffer = { readLatest: vi.fn().mockResolvedValue(FEATURES) };
    aiScoreClient = { score: vi.fn().mockResolvedValue(SCORE) };
    matchmakingService = { emitToUser: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ScoreTickSchedulerService,
        { provide: PrismaService, useValue: prisma },
        { provide: ScoreSampleBufferService, useValue: sampleBuffer },
        { provide: AiScoreClientService, useValue: aiScoreClient },
        { provide: MatchmakingService, useValue: matchmakingService },
      ],
    }).compile();
    service = moduleRef.get(ScoreTickSchedulerService);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("não emite enquanto algum jogador ainda não mandou nenhuma amostra", async () => {
    sampleBuffer.readLatest.mockResolvedValueOnce(null).mockResolvedValueOnce(FEATURES);
    service.ensureScheduledForMatch("match-1", "player-1", "player-2");

    await vi.advanceTimersByTimeAsync(1000);

    expect(matchmakingService.emitToUser).not.toHaveBeenCalled();
  });

  it("emite match:score-tick para os dois jogadores quando ambos têm amostra", async () => {
    service.ensureScheduledForMatch("match-1", "player-1", "player-2");

    await vi.advanceTimersByTimeAsync(1000);

    expect(matchmakingService.emitToUser).toHaveBeenCalledTimes(2);
    const [userId, event, payload] = matchmakingService.emitToUser.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(userId).toBe("player-1");
    expect(event).toBe("match:score-tick");
    expect(payload).toMatchObject({
      matchId: "match-1",
      scores: [
        { userId: "player-1", liveScore: 0.6 },
        { userId: "player-2", liveScore: 0.6 },
      ],
    });
  });

  it("grava o estado ao vivo (features/score) no Match a cada tick", async () => {
    service.ensureScheduledForMatch("match-1", "player-1", "player-2");
    await vi.advanceTimersByTimeAsync(1000);

    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: "match-1" },
      data: {
        featuresPlayer1: FEATURES,
        featuresPlayer2: FEATURES,
        scorePlayer1: SCORE,
        scorePlayer2: SCORE,
      },
    });
  });

  it("para de emitir e cancela o interval quando a partida deixa de estar active", async () => {
    prisma.match.findUnique.mockResolvedValue({ id: "match-1", status: "completed" });
    service.ensureScheduledForMatch("match-1", "player-1", "player-2");

    await vi.advanceTimersByTimeAsync(3000);

    expect(matchmakingService.emitToUser).not.toHaveBeenCalled();
  });

  it("ensureScheduledForMatch é idempotente — chamar duas vezes não duplica o interval", async () => {
    service.ensureScheduledForMatch("match-1", "player-1", "player-2");
    service.ensureScheduledForMatch("match-1", "player-1", "player-2");

    await vi.advanceTimersByTimeAsync(1000);

    expect(matchmakingService.emitToUser).toHaveBeenCalledTimes(2); // não 4
  });

  it("cancel() para futuros ticks", async () => {
    service.ensureScheduledForMatch("match-1", "player-1", "player-2");
    service.cancel("match-1");

    await vi.advanceTimersByTimeAsync(5000);

    expect(matchmakingService.emitToUser).not.toHaveBeenCalled();
  });
});
