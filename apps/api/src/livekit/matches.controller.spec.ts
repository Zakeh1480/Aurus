import type { User } from "@aurafarming/shared";
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { LivekitService } from "./livekit.service";
import { MatchesController } from "./matches.controller";

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

describe("MatchesController", () => {
  let controller: MatchesController;
  let prisma: { match: { findUnique: ReturnType<typeof vi.fn> } };
  let livekit: {
    ensureRoom: ReturnType<typeof vi.fn>;
    createToken: ReturnType<typeof vi.fn>;
    publicUrl: string;
  };

  beforeEach(async () => {
    prisma = { match: { findUnique: vi.fn() } };
    livekit = {
      ensureRoom: vi.fn().mockResolvedValue(undefined),
      createToken: vi.fn().mockResolvedValue({ token: "jwt.token.value", expiresAt: new Date("2026-01-01T02:00:00.000Z") }),
      publicUrl: "wss://aurafarming.livekit.cloud",
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: LivekitService, useValue: livekit },
      ],
    }).compile();

    controller = moduleRef.get(MatchesController);
  });

  it("emite o token quando o usuário é player1 de uma partida active", async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: "match-1",
      player1Id: USER_A,
      player2Id: USER_B,
      status: "active",
    });

    const result = await controller.issueToken("match-1", buildUser({ id: USER_A }));

    expect(livekit.ensureRoom).toHaveBeenCalledWith("match-1");
    expect(livekit.createToken).toHaveBeenCalledWith("match-1", USER_A);
    expect(result).toEqual({
      token: "jwt.token.value",
      url: "wss://aurafarming.livekit.cloud",
      roomName: "match-1",
      identity: USER_A,
      expiresAt: "2026-01-01T02:00:00.000Z",
    });
  });

  it("emite o token quando o usuário é player2 de uma partida active", async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: "match-1",
      player1Id: USER_A,
      player2Id: USER_B,
      status: "active",
    });

    await expect(controller.issueToken("match-1", buildUser({ id: USER_B }))).resolves.toMatchObject({
      identity: USER_B,
    });
  });

  it("lança 404 quando a partida não existe", async () => {
    prisma.match.findUnique.mockResolvedValue(null);

    await expect(controller.issueToken("match-inexistente", buildUser())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(livekit.createToken).not.toHaveBeenCalled();
  });

  it("lança 403 quando o usuário autenticado não participa da partida", async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: "match-1",
      player1Id: USER_A,
      player2Id: USER_B,
      status: "active",
    });

    await expect(controller.issueToken("match-1", buildUser({ id: USER_C }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(livekit.createToken).not.toHaveBeenCalled();
  });

  it("lança 409 quando a partida ainda não está active", async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: "match-1",
      player1Id: USER_A,
      player2Id: USER_B,
      status: "pending",
    });

    await expect(controller.issueToken("match-1", buildUser({ id: USER_A }))).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(livekit.createToken).not.toHaveBeenCalled();
  });
});
