import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MatchmakingService } from "../matchmaking/matchmaking.service";
import { PrismaService } from "../prisma/prisma.service";
import { ChallengeSchedulerService } from "./challenge-scheduler.service";
import { NonceService } from "./nonce.service";
import { TrustScoreService } from "./trust-score.service";

describe("ChallengeSchedulerService", () => {
  let prisma: { match: { findUnique: ReturnType<typeof vi.fn> } };
  let nonceService: { issueChallengeNonce: ReturnType<typeof vi.fn> };
  let trustScoreService: { recordChallengeIssued: ReturnType<typeof vi.fn> };
  let matchmakingService: { emitToUser: ReturnType<typeof vi.fn> };
  let service: ChallengeSchedulerService;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubEnv("ANTI_CHEAT_CHALLENGES_MIN", "2");
    vi.stubEnv("ANTI_CHEAT_CHALLENGES_MAX", "2");
    vi.stubEnv("ANTI_CHEAT_CHALLENGE_INTERVAL_MIN_MS", "1000");
    vi.stubEnv("ANTI_CHEAT_CHALLENGE_INTERVAL_MAX_MS", "1000");

    prisma = { match: { findUnique: vi.fn().mockResolvedValue({ id: "match-1", status: "active" }) } };
    nonceService = { issueChallengeNonce: vi.fn().mockResolvedValue(undefined) };
    trustScoreService = { recordChallengeIssued: vi.fn().mockResolvedValue(undefined) };
    matchmakingService = { emitToUser: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChallengeSchedulerService,
        { provide: PrismaService, useValue: prisma },
        { provide: NonceService, useValue: nonceService },
        { provide: TrustScoreService, useValue: trustScoreService },
        { provide: MatchmakingService, useValue: matchmakingService },
      ],
    }).compile();
    service = moduleRef.get(ChallengeSchedulerService);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("dispara exatamente challengesMin==challengesMax desafios por jogador (2 cada, com MIN=MAX=2)", async () => {
    service.ensureScheduledForMatch("match-1", "player-1", "player-2");

    await vi.advanceTimersByTimeAsync(3000);

    const emittedForPlayer1 = matchmakingService.emitToUser.mock.calls.filter((call) => call[0] === "player-1");
    const emittedForPlayer2 = matchmakingService.emitToUser.mock.calls.filter((call) => call[0] === "player-2");
    expect(emittedForPlayer1).toHaveLength(2);
    expect(emittedForPlayer2).toHaveLength(2);
  });

  it("é idempotente — chamar ensureScheduledForMatch duas vezes para o mesmo match+user não dobra os desafios", async () => {
    service.ensureScheduledForMatch("match-1", "player-1", "player-2");
    service.ensureScheduledForMatch("match-1", "player-1", "player-2");

    await vi.advanceTimersByTimeAsync(3000);

    expect(matchmakingService.emitToUser).toHaveBeenCalledTimes(4); // 2 desafios x 2 jogadores, não 8
  });

  it("nunca emite quando a partida não está mais active", async () => {
    prisma.match.findUnique.mockResolvedValue({ id: "match-1", status: "completed" });

    service.ensureScheduledForMatch("match-1", "player-1", "player-2");
    await vi.advanceTimersByTimeAsync(3000);

    expect(matchmakingService.emitToUser).not.toHaveBeenCalled();
    expect(trustScoreService.recordChallengeIssued).not.toHaveBeenCalled();
  });

  it("cada desafio emitido registra o nonce e incrementa o contador de challengesIssued", async () => {
    service.ensureScheduledForMatch("match-1", "player-1", "player-2");
    await vi.advanceTimersByTimeAsync(1000);

    expect(nonceService.issueChallengeNonce).toHaveBeenCalledWith(
      "match-1",
      "player-1",
      expect.any(String),
      expect.any(String),
      expect.any(Number),
    );
    expect(trustScoreService.recordChallengeIssued).toHaveBeenCalledWith("match-1", "player-1");
  });

  it("payload emitido bate com o formato de MatchVerifyChallengePayload", async () => {
    service.ensureScheduledForMatch("match-1", "player-1", "player-2");
    await vi.advanceTimersByTimeAsync(1000);

    const [, event, payload] = matchmakingService.emitToUser.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(event).toBe("match:verify-challenge");
    expect(payload).toMatchObject({ matchId: "match-1", userId: "player-1", challengeType: "snapshot" });
    expect(typeof payload["nonce"]).toBe("string");
    expect(typeof payload["challengeId"]).toBe("string");
  });
});
