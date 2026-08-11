import { type VerifyRequest, type VerifyResponse, VerifyResponseSchema } from '@aurafarming/shared';
import { Injectable } from '@nestjs/common';

import { getAiServiceSecret } from '../common/internal-service-secret';
import { getAntiCheatConfig } from './anti-cheat.constants';

@Injectable()
export class AiVerifyClientService {
  async verify(request: VerifyRequest): Promise<VerifyResponse> {
    const { aiServiceUrl, aiVerifyTimeoutMs } = getAntiCheatConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), aiVerifyTimeoutMs);
    try {
      const response = await fetch(`${aiServiceUrl}/verify`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ai-service-secret': getAiServiceSecret(),
        },
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
