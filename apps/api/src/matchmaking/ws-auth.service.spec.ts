import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import type { User as PrismaUser } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { WsAuthService } from "./ws-auth.service";

function buildUser(overrides: Partial<PrismaUser> = {}): PrismaUser {
  return {
    id: "user-1",
    email: "player@example.com",
    passwordHash: "irrelevant",
    displayName: "Player One",
    avatarUrl: null,
    anonymizedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("WsAuthService", () => {
  let wsAuthService: WsAuthService;
  let jwtService: JwtService;
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    prisma = { user: { findUnique: vi.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        WsAuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: new JwtService({ secret: "test-secret" }) },
      ],
    }).compile();

    wsAuthService = moduleRef.get(WsAuthService);
    jwtService = moduleRef.get(JwtService);
  });

  it("resolve o userId para um token válido de usuário ativo", async () => {
    const token = jwtService.sign({ sub: "user-1" });
    prisma.user.findUnique.mockResolvedValue(buildUser());

    await expect(wsAuthService.authenticate(token)).resolves.toBe("user-1");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: "user-1" } });
  });

  it("lança quando o token está ausente", async () => {
    await expect(wsAuthService.authenticate(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("lança quando o token é inválido", async () => {
    await expect(wsAuthService.authenticate("token-invalido")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("lança quando o token está expirado", async () => {
    const token = jwtService.sign({ sub: "user-1" }, { expiresIn: -1 });
    await expect(wsAuthService.authenticate(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("lança quando o usuário não é encontrado", async () => {
    const token = jwtService.sign({ sub: "user-fantasma" });
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(wsAuthService.authenticate(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("lança quando a conta foi anonimizada (LGPD), mesmo com token válido", async () => {
    const token = jwtService.sign({ sub: "user-1" });
    prisma.user.findUnique.mockResolvedValue(buildUser({ anonymizedAt: new Date() }));

    await expect(wsAuthService.authenticate(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
