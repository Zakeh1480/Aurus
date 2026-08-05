import { Test } from "@nestjs/testing";
import type { Consent as PrismaConsent } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { ConsentService } from "./consent.service";

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

describe("ConsentService", () => {
  let consentService: ConsentService;
  let prisma: {
    consent: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    prisma = {
      consent: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ConsentService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    consentService = moduleRef.get(ConsentService);
  });

  describe("grant", () => {
    it("registra um novo consentimento com timestamp e versão do termo", async () => {
      prisma.consent.create.mockResolvedValue(buildConsent());

      const result = await consentService.grant("user-1", { type: "camera", termsVersion: "v1" });

      expect(prisma.consent.create).toHaveBeenCalledWith({
        data: { userId: "user-1", type: "camera", termsVersion: "v1" },
      });
      expect(result).toMatchObject({ type: "camera", termsVersion: "v1", userId: "user-1" });
      expect(result.grantedAt).toEqual(expect.any(String));
    });

    it("cria um novo registro a cada chamada (mantém o histórico de auditoria)", async () => {
      prisma.consent.create.mockResolvedValueOnce(buildConsent({ id: "consent-1" }));
      prisma.consent.create.mockResolvedValueOnce(buildConsent({ id: "consent-2" }));

      await consentService.grant("user-1", { type: "camera", termsVersion: "v1" });
      await consentService.grant("user-1", { type: "camera", termsVersion: "v2" });

      expect(prisma.consent.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("list", () => {
    it("retorna só os consentimentos do titular, em ordem cronológica", async () => {
      prisma.consent.findMany.mockResolvedValue([buildConsent()]);

      const result = await consentService.list("user-1");

      expect(prisma.consent.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { grantedAt: "asc" },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("status", () => {
    it("reporta granted: false para todo ConsentType quando nada foi registrado (Prompt 13: inclui 'terms')", async () => {
      prisma.consent.findFirst.mockResolvedValue(null);

      const result = await consentService.status("user-1");

      expect(result).toEqual([
        { type: "camera", granted: false, termsVersion: null, grantedAt: null },
        { type: "terms", granted: false, termsVersion: null, grantedAt: null },
      ]);
    });

    it("reporta granted: true com os dados do último consentimento concedido", async () => {
      prisma.consent.findFirst.mockResolvedValue(buildConsent({ termsVersion: "v2" }));

      const result = await consentService.status("user-1");

      expect(result[0]).toMatchObject({ type: "camera", granted: true, termsVersion: "v2" });
      expect(prisma.consent.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-1", type: "camera" },
        orderBy: { grantedAt: "desc" },
      });
    });
  });
});
