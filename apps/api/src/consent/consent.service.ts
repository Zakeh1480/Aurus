import { ConsentTypeSchema, type Consent, type ConsentStatus, type GrantConsentRequest } from "@aurafarming/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { toConsent } from "./mappers/to-consent.mapper";

@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async grant(userId: string, input: GrantConsentRequest): Promise<Consent> {
    const created = await this.prisma.consent.create({
      data: { userId, type: input.type, termsVersion: input.termsVersion },
    });
    return toConsent(created);
  }

  async list(userId: string): Promise<Consent[]> {
    const consents = await this.prisma.consent.findMany({
      where: { userId },
      orderBy: { grantedAt: "asc" },
    });
    return consents.map(toConsent);
  }

  async status(userId: string): Promise<ConsentStatus[]> {
    return Promise.all(
      ConsentTypeSchema.options.map(async (type): Promise<ConsentStatus> => {
        const latest = await this.prisma.consent.findFirst({
          where: { userId, type },
          orderBy: { grantedAt: "desc" },
        });
        return {
          type,
          granted: latest !== null,
          termsVersion: latest?.termsVersion ?? null,
          grantedAt: latest ? latest.grantedAt.toISOString() : null,
        };
      }),
    );
  }
}
