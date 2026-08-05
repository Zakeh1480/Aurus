import { Test } from "@nestjs/testing";
import {
  Prisma,
  type User as PrismaUser,
  type Profile as PrismaProfile,
  type Consent as PrismaConsent,
  type Match as PrismaMatch,
  type MatchParticipant as PrismaMatchParticipant,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

function buildUser(overrides: Partial<PrismaUser> = {}): PrismaUser {
  return {
    id: "user-1",
    email: "player@example.com",
    passwordHash: "irrelevant",
    displayName: "Player One",
    avatarUrl: null,
    anonymizedAt: null,
    role: "user",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function buildProfile(overrides: Partial<PrismaProfile> = {}): PrismaProfile {
  return {
    userId: "user-1",
    nickname: "PlayerOne",
    avatarUrl: null,
    bio: null,
    rating: 1000,
    auraScoreAvg: null,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function buildConsent(overrides: Partial<PrismaConsent> = {}): PrismaConsent {
  return {
    id: "consent-1",
    userId: "user-1",
    type: "camera",
    termsVersion: "v1",
    grantedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function buildMatch(overrides: Partial<PrismaMatch> = {}): PrismaMatch {
  return {
    id: "match-1",
    player1Id: "user-1",
    player2Id: "user-2",
    status: "completed",
    scoreVersion: "aura-score-v1",
    featuresPlayer1: null,
    featuresPlayer2: null,
    scorePlayer1: null,
    scorePlayer2: null,
    winnerId: "user-1",
    startedAt: new Date("2026-01-01T00:05:00.000Z"),
    endedAt: new Date("2026-01-01T00:10:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function buildParticipation(
  overrides: Partial<PrismaMatchParticipant> = {},
  match: PrismaMatch = buildMatch(),
): PrismaMatchParticipant & { match: PrismaMatch } {
  return {
    id: "participant-1",
    matchId: match.id,
    userId: "user-1",
    side: "player1",
    ratingBefore: 1000,
    ratingAfter: 1012,
    createdAt: match.createdAt,
    match,
    ...overrides,
  };
}

describe("UsersService", () => {
  let usersService: UsersService;
  let prisma: {
    user: { findUniqueOrThrow: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    profile: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
    };
    consent: { findMany: ReturnType<typeof vi.fn> };
    matchParticipant: { findMany: ReturnType<typeof vi.fn> };
    refreshToken: { updateMany: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
      profile: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      consent: { findMany: vi.fn() },
      matchParticipant: { findMany: vi.fn() },
      refreshToken: { updateMany: vi.fn() },
      $transaction: vi.fn((operations: unknown[]) => Promise.all(operations)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    usersService = moduleRef.get(UsersService);
  });

  describe("getProfile", () => {
    it("retorna o perfil existente sem criar um novo", async () => {
      prisma.profile.findUnique.mockResolvedValue(buildProfile());

      const result = await usersService.getProfile("user-1");

      expect(result.nickname).toBe("PlayerOne");
      expect(prisma.profile.create).not.toHaveBeenCalled();
    });

    it("cria o perfil com nickname padrão (displayName) quando ainda não existe", async () => {
      prisma.profile.findUnique.mockResolvedValue(null);
      prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser({ displayName: "Player One" }));
      prisma.profile.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(buildProfile({ nickname: data["nickname"] as string })),
      );

      const result = await usersService.getProfile("user-1");

      expect(prisma.profile.create).toHaveBeenCalledWith({ data: { userId: "user-1", nickname: "Player One" } });
      expect(result.nickname).toBe("Player One");
    });

    it("trata corrida de criação concorrente (P2002) relendo o perfil já criado", async () => {
      prisma.profile.findUnique.mockResolvedValue(null);
      prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser());
      prisma.profile.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "7.9.1",
        }),
      );
      prisma.profile.findUniqueOrThrow.mockResolvedValue(buildProfile());

      const result = await usersService.getProfile("user-1");

      expect(result.nickname).toBe("PlayerOne");
    });
  });

  describe("updateProfile", () => {
    it("garante que o perfil existe e aplica só os campos enviados", async () => {
      prisma.profile.findUnique.mockResolvedValue(buildProfile());
      prisma.profile.update.mockResolvedValue(buildProfile({ bio: "Nova bio" }));

      const result = await usersService.updateProfile("user-1", { bio: "Nova bio" });

      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: { bio: "Nova bio" },
      });
      expect(result.bio).toBe("Nova bio");
    });

    it("só atualiza o perfil do usuário informado, nunca de outro", async () => {
      prisma.profile.findUnique.mockResolvedValue(buildProfile({ userId: "user-2" }));
      prisma.profile.update.mockResolvedValue(buildProfile({ userId: "user-2", nickname: "Outro" }));

      await usersService.updateProfile("user-2", { nickname: "Outro" });

      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { userId: "user-2" },
        data: { nickname: "Outro" },
      });
    });
  });

  describe("exportData", () => {
    it("retorna perfil, consentimentos e histórico de partidas completos do titular", async () => {
      const match = buildMatch();
      prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser());
      prisma.profile.findUnique.mockResolvedValue(buildProfile());
      prisma.consent.findMany.mockResolvedValue([buildConsent()]);
      prisma.matchParticipant.findMany.mockResolvedValue([buildParticipation({}, match)]);

      const result = await usersService.exportData("user-1");

      expect(result.user.email).toBe("player@example.com");
      expect(result.user.role).toBe("user");
      expect(result.profile?.nickname).toBe("PlayerOne");
      expect(result.consents).toHaveLength(1);
      expect(result.consents[0]).toMatchObject({ type: "camera", termsVersion: "v1" });
      expect(result.matchHistory).toHaveLength(1);
      expect(result.matchHistory[0]).toMatchObject({
        matchId: match.id,
        side: "player1",
        status: "completed",
        ratingBefore: 1000,
        ratingAfter: 1012,
      });
      expect(result.exportedAt).toEqual(expect.any(String));
    });

    it("retorna profile nulo quando o titular ainda não criou um perfil", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser());
      prisma.profile.findUnique.mockResolvedValue(null);
      prisma.consent.findMany.mockResolvedValue([]);
      prisma.matchParticipant.findMany.mockResolvedValue([]);

      const result = await usersService.exportData("user-1");

      expect(result.profile).toBeNull();
    });

    it("inclui consentimentos de tipo 'terms' junto com os de 'camera', sem filtro por tipo (Prompt 13)", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser());
      prisma.profile.findUnique.mockResolvedValue(buildProfile());
      prisma.consent.findMany.mockResolvedValue([
        buildConsent({ type: "camera" }),
        buildConsent({ id: "consent-2", type: "terms", termsVersion: "2026-08-04" }),
      ]);
      prisma.matchParticipant.findMany.mockResolvedValue([]);

      const result = await usersService.exportData("user-1");

      expect(result.consents).toHaveLength(2);
      expect(result.consents.map((consent) => consent.type)).toEqual(["camera", "terms"]);
    });

    it("consulta os dados filtrando estritamente pelo userId do titular", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser());
      prisma.profile.findUnique.mockResolvedValue(null);
      prisma.consent.findMany.mockResolvedValue([]);
      prisma.matchParticipant.findMany.mockResolvedValue([]);

      await usersService.exportData("user-1");

      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "user-1" } });
      expect(prisma.profile.findUnique).toHaveBeenCalledWith({ where: { userId: "user-1" } });
      expect(prisma.consent.findMany.mock.calls[0]![0]).toMatchObject({ where: { userId: "user-1" } });
      expect(prisma.matchParticipant.findMany.mock.calls[0]![0]).toMatchObject({ where: { userId: "user-1" } });
    });
  });

  describe("remove (anonimização)", () => {
    it("anonimiza e-mail/nome/avatar do usuário e do perfil, e revoga os refresh tokens", async () => {
      await usersService.remove("user-1");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          email: "anon-user-1@anonymized.aurafarming.local",
          displayName: "Usuário removido",
          avatarUrl: null,
          anonymizedAt: expect.any(Date),
        },
      });
      expect(prisma.profile.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: { nickname: "Jogador removido", avatarUrl: null, bio: null },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("aplica as três atualizações numa única transação atômica (sem deletar linhas)", async () => {
      await usersService.remove("user-1");

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const operations = prisma.$transaction.mock.calls[0]![0] as unknown[];
      expect(operations).toHaveLength(3);
    });

    it("é idempotente: chamar duas vezes gera o mesmo e-mail anonimizado determinístico", async () => {
      await usersService.remove("user-1");
      await usersService.remove("user-1");

      const firstCallEmail = prisma.user.update.mock.calls[0]![0].data.email;
      const secondCallEmail = prisma.user.update.mock.calls[1]![0].data.email;
      expect(firstCallEmail).toBe(secondCallEmail);
    });

    it("nunca toca em role ao anonimizar (Prompt 13) — um moderador banido continua ambos após a anonimização", async () => {
      await usersService.remove("user-1");

      const updateData = prisma.user.update.mock.calls[0]![0].data as Record<string, unknown>;
      expect(updateData).not.toHaveProperty("role");
    });
  });
});
