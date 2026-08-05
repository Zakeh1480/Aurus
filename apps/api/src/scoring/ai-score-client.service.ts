import { type AuraFeatures, type AuraScore, AuraScoreSchema } from "@aurafarming/shared";
import { Injectable } from "@nestjs/common";

import { getAiServiceSecret } from "../common/internal-service-secret";
import { getScoringConfig } from "./scoring.constants";

/**
 * Cliente HTTP para POST /score e POST /score/aggregate no serviço de IA —
 * caminho principal de scoring (Prompt 7), separado de AiVerifyClientService
 * (Prompt 6b, só /verify). Mesmo padrão: fetch/AbortController nativos, sem
 * dependência HTTP nova.
 */
@Injectable()
export class AiScoreClientService {
  async score(features: AuraFeatures): Promise<AuraScore> {
    return this.post("/score", features);
  }

  async aggregate(samples: AuraFeatures[]): Promise<AuraScore> {
    return this.post("/score/aggregate", { samples });
  }

  private async post(path: string, body: unknown): Promise<AuraScore> {
    const { aiServiceUrl, aiScoreTimeoutMs } = getScoringConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), aiScoreTimeoutMs);
    try {
      const response = await fetch(`${aiServiceUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-ai-service-secret": getAiServiceSecret() },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`AI ${path} respondeu ${response.status}`);
      }
      return AuraScoreSchema.parse(await response.json());
    } finally {
      clearTimeout(timeout);
    }
  }
}
