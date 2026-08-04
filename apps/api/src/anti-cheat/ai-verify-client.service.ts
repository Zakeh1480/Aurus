import { type VerifyRequest, type VerifyResponse, VerifyResponseSchema } from "@aurafarming/shared";
import { Injectable } from "@nestjs/common";

import { getAntiCheatConfig } from "./anti-cheat.constants";

/**
 * Cliente HTTP mínimo, só para POST /verify no serviço de IA — não é um
 * cliente geral (sem métodos de /score). O Prompt 7 constrói seu próprio
 * cliente para o caminho de scoring principal. Usa fetch/AbortController
 * nativos do Node (>=20.11, já é o piso do monorepo) — sem dependência nova.
 */
@Injectable()
export class AiVerifyClientService {
  async verify(request: VerifyRequest): Promise<VerifyResponse> {
    const { aiServiceUrl, aiVerifyTimeoutMs } = getAntiCheatConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), aiVerifyTimeoutMs);
    try {
      const response = await fetch(`${aiServiceUrl}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`AI /verify respondeu ${response.status}`);
      }
      return VerifyResponseSchema.parse(await response.json());
    } finally {
      clearTimeout(timeout);
    }
  }
}
