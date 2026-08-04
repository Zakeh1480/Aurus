import type { MatchTrustDecision } from "@aurafarming/shared";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AntiCheatService } from "./anti-cheat.service";
import { TrustScoreService } from "./trust-score.service";

describe("AntiCheatService", () => {
  let trustScoreService: { getMatchDecision: ReturnType<typeof vi.fn> };
  let service: AntiCheatService;

  beforeEach(async () => {
    trustScoreService = { getMatchDecision: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [AntiCheatService, { provide: TrustScoreService, useValue: trustScoreService }],
    }).compile();
    service = moduleRef.get(AntiCheatService);
  });

  it("getMatchDecision delega para TrustScoreService", async () => {
    const decision = { matchId: "match-1", overallDecision: "valid" } as unknown as MatchTrustDecision;
    trustScoreService.getMatchDecision.mockResolvedValue(decision);

    await expect(service.getMatchDecision("match-1")).resolves.toBe(decision);
    expect(trustScoreService.getMatchDecision).toHaveBeenCalledWith("match-1");
  });
});
