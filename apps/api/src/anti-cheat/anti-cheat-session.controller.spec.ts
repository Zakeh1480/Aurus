import type { User } from "@aurafarming/shared";
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { AntiCheatSessionController } from "./anti-cheat-session.controller";
import { ChallengeSchedulerService } from "./challenge-scheduler.service";
import { SessionSecretService } from "./session-secret.service";

const USER_A = "123e4567-e89b-12d3-a456-426614174000";
const USER_B = "223e4567-e89b-12d3-a456-426614174001";
const USER_C = "323e4567-e89b-12d3-a456-426614174002";

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_A,
    email: "player@example.com",
    displayName: "Player One",
    avatarUrl: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("AntiCheatSessionController", () => {
  let controller: AntiCheatSessionController;
  let prisma: { match: { findUnique: ReturnType<typeof vi.fn> } };
  let sessionSecretService: { issue: ReturnType<typeof vi.fn> };
  let challengeScheduler: { ensureScheduledForMatch: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = { match: { findUnique: vi.fn() } };
    sessionSecretService = {
      issue: vi.fn().mockResolvedValue({ secret: "s".repeat(32), expiresAt: new Date("2026-01-01T03:00:00.000Z") }),
    };
    challengeScheduler = { ensureScheduledForMatch: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AntiCheatSessionController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: SessionSecretService, useValue: sessionSecretService },
        { provide: ChallengeSchedulerService, useValue: challengeScheduler },
      ],
    }).compile();

    controller = moduleRef.get(AntiCheatSessionController);
  });

  const MATCH_ID = "423e4567-e89b-12d3-a456-426614174003";

  it("emite o segredo e dispara o agendamento quando o usuário é participante de uma partida active", async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: MATCH_ID,
      player1Id: USER_A,
      player2Id: USER_B,
      status: "active",
    });

    const result = await controller.issueSecret(MATCH_ID, buildUser({ id: USER_A }));

    expect(sessionSecretService.issue).toHaveBeenCalledWith(MATCH_ID, USER_A);
    expect(challengeScheduler.ensureScheduledForMatch).toHaveBeenCalledWith(MATCH_ID, USER_A, USER_B);
    expect(result).toEqual({
      matchId: MATCH_ID,
      userId: USER_A,
      sessionSecret: "s".repeat(32),
      expiresAt: "2026-01-01T03:00:00.000Z",
    });
  });

  it("lança 404 quando a partida não existe", async () => {
    prisma.match.findUnique.mockResolvedValue(null);

    await expect(controller.issueSecret("match-inexistente", buildUser())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(sessionSecretService.issue).not.toHaveBeenCalled();
  });

  it("lança 403 quando o usuário autenticado não participa da partida", async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: "match-1",
      player1Id: USER_A,
      player2Id: USER_B,
      status: "active",
    });

    await expect(controller.issueSecret("match-1", buildUser({ id: USER_C }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(sessionSecretService.issue).not.toHaveBeenCalled();
  });

  it("lança 409 quando a partida ainda não está active", async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: "match-1",
      player1Id: USER_A,
      player2Id: USER_B,
      status: "pending",
    });

    await expect(controller.issueSecret("match-1", buildUser({ id: USER_A }))).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(sessionSecretService.issue).not.toHaveBeenCalled();
  });
});
