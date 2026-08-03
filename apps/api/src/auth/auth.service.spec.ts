import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { Prisma, type User as PrismaUser, type RefreshToken as PrismaRefreshToken } from "@prisma/client";
import * as argon2 from "argon2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";
import { hashToken } from "./token.util";

function buildUser(overrides: Partial<PrismaUser> = {}): PrismaUser {
  return {
    id: "user-1",
    email: "player@example.com",
    passwordHash: "will-be-overwritten",
    displayName: "Player One",
    avatarUrl: null,
    anonymizedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function buildRefreshToken(overrides: Partial<PrismaRefreshToken> = {}): PrismaRefreshToken {
  return {
    id: "token-1",
    userId: "user-1",
    tokenHash: "irrelevant-for-lookup",
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("AuthService", () => {
  let authService: AuthService;
  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    refreshToken: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: vi.fn(), create: vi.fn() },
      refreshToken: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: new JwtService({ secret: "test-secret" }) },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  describe("register", () => {
    it("cria o usuário com hash argon2id e nunca retorna o hash", async () => {
      prisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(buildUser({ passwordHash: data["passwordHash"] as string })),
      );

      const result = await authService.register({
        email: "player@example.com",
        password: "senha-forte-123",
        displayName: "Player One",
      });

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      const createdData = prisma.user.create.mock.calls[0]![0].data;
      expect(createdData.passwordHash).not.toBe("senha-forte-123");
      expect(createdData.passwordHash).toMatch(/^\$argon2id\$/);
      expect(await argon2.verify(createdData.passwordHash, "senha-forte-123")).toBe(true);

      expect(result).not.toHaveProperty("passwordHash");
      expect(result.email).toBe("player@example.com");
    });

    it("lança ConflictException quando o e-mail já existe (P2002)", async () => {
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "7.9.1",
        }),
      );

      await expect(
        authService.register({
          email: "player@example.com",
          password: "senha-forte-123",
          displayName: "Player One",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("login", () => {
    it("retorna user, tokens e refreshToken quando as credenciais são válidas", async () => {
      const passwordHash = await argon2.hash("senha-correta", { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash }));
      prisma.refreshToken.create.mockResolvedValue(buildRefreshToken());

      const result = await authService.login({ email: "player@example.com", password: "senha-correta" });

      expect(result.user.email).toBe("player@example.com");
      expect(result.tokens.accessToken).toEqual(expect.any(String));
      expect(result.tokens.expiresIn).toBe(900);
      expect(result.refreshToken).toEqual(expect.any(String));

      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      const refreshData = prisma.refreshToken.create.mock.calls[0]![0].data;
      expect(refreshData.tokenHash).toBe(hashToken(result.refreshToken));
      expect(refreshData.tokenHash).not.toBe(result.refreshToken);
    });

    it("rejeita com a mesma mensagem quando o e-mail não existe", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.login({ email: "ghost@example.com", password: "qualquer" })).rejects.toMatchObject({
        message: "Credenciais inválidas.",
      });
    });

    it("rejeita com a mesma mensagem quando a senha está errada", async () => {
      const passwordHash = await argon2.hash("senha-correta", { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash }));

      await expect(
        authService.login({ email: "player@example.com", password: "senha-errada" }),
      ).rejects.toMatchObject({ message: "Credenciais inválidas." });
    });

    it("rejeita login de usuário anonimizado mesmo com senha correta", async () => {
      const passwordHash = await argon2.hash("senha-correta", { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash, anonymizedAt: new Date() }));

      await expect(
        authService.login({ email: "player@example.com", password: "senha-correta" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("refresh", () => {
    it("rotaciona o token: revoga o antigo e emite um novo", async () => {
      const rawToken = "raw-refresh-token";
      const stored = buildRefreshToken({ tokenHash: hashToken(rawToken) });
      prisma.refreshToken.findUnique.mockResolvedValue(stored);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.refreshToken.create.mockResolvedValue(buildRefreshToken({ id: "token-2" }));

      const result = await authService.refresh(rawToken);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.refreshToken).not.toBe(rawToken);
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      const newHash = prisma.refreshToken.create.mock.calls[0]![0].data.tokenHash;
      expect(newHash).toBe(hashToken(result.refreshToken));
    });

    it("rejeita quando o token não existe", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(authService.refresh("token-inexistente")).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it("rejeita token expirado sem revogar a família", async () => {
      const rawToken = "raw-refresh-token";
      const stored = buildRefreshToken({
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() - 1000),
      });
      prisma.refreshToken.findUnique.mockResolvedValue(stored);

      await expect(authService.refresh(rawToken)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it("detecta reuso de token já revogado e revoga toda a família do usuário", async () => {
      const rawToken = "raw-refresh-token";
      const stored = buildRefreshToken({ tokenHash: hashToken(rawToken), revokedAt: new Date() });
      prisma.refreshToken.findUnique.mockResolvedValue(stored);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await expect(authService.refresh(rawToken)).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it("trata corrida perdida no claim (count 0) como reuso e revoga a família", async () => {
      const rawToken = "raw-refresh-token";
      const stored = buildRefreshToken({ tokenHash: hashToken(rawToken), revokedAt: null });
      prisma.refreshToken.findUnique.mockResolvedValue(stored);
      // Primeira chamada (claim de rotação) perde a corrida; segunda chamada é o revoke-all.
      prisma.refreshToken.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });

      await expect(authService.refresh(rawToken)).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.refreshToken.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenNthCalledWith(2, {
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it("rejeita quando o usuário foi anonimizado após o claim", async () => {
      const rawToken = "raw-refresh-token";
      const stored = buildRefreshToken({ tokenHash: hashToken(rawToken) });
      prisma.refreshToken.findUnique.mockResolvedValue(stored);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue(buildUser({ anonymizedAt: new Date() }));

      await expect(authService.refresh(rawToken)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("revoga apenas o token apresentado", async () => {
      const rawToken = "raw-refresh-token";
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await authService.logout(rawToken);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: hashToken(rawToken), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("não chama o Prisma quando não há token", async () => {
      await authService.logout(undefined);
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });
});
