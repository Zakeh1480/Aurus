import type { VerifyRequest } from '@aurafarming/shared';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiVerifyClientService } from './ai-verify-client.service';

const REQUEST: VerifyRequest = {
  matchId: '123e4567-e89b-12d3-a456-426614174000',
  userId: '223e4567-e89b-12d3-a456-426614174001',
  challengeId: '323e4567-e89b-12d3-a456-426614174002',
  keyframeBase64: 'ZmFrZS1rZXlmcmFtZQ==',
  claimedFeatures: {
    posture: 0.5,
    eyeContact: 0.5,
    expression: 0.5,
    presence: 0.5,
    movement: 0.5,
    sequence: 0,
    capturedAt: '2026-01-01T00:00:00.000Z',
  },
};

const VALID_RESPONSE_BODY = {
  matchId: REQUEST.matchId,
  userId: REQUEST.userId,
  challengeId: REQUEST.challengeId,
  discrepancy: 0.1,
  discrepancyConfidence: 1.0,
  liveness: {
    noFaceDetected: false,
    staticImageSuspected: false,
    lowDetailSuspected: false,
    multipleFacesDetected: false,
  },
  version: 'anti-cheat-v1',
  computedAt: '2026-01-01T00:00:01.000Z',
};

describe('AiVerifyClientService', () => {
  let service: AiVerifyClientService;

  beforeEach(async () => {
    vi.stubEnv('AI_SERVICE_SHARED_SECRET', 'test-secret');
    const moduleRef = await Test.createTestingModule({
      providers: [AiVerifyClientService],
    }).compile();
    service = moduleRef.get(AiVerifyClientService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('retorna a VerifyResponse quando a chamada é bem-sucedida', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(VALID_RESPONSE_BODY),
        }),
    );

    const result = await service.verify(REQUEST);

    expect(result.discrepancy).toBe(0.1);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/verify',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('lança quando a resposta HTTP não é 2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) }),
    );
    await expect(service.verify(REQUEST)).rejects.toThrow();
  });

  it('lança quando o corpo da resposta não bate com VerifyResponseSchema', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ garbage: true }),
        }),
    );
    await expect(service.verify(REQUEST)).rejects.toThrow();
  });

  it('aborta a chamada após aiVerifyTimeoutMs (timeout configurável)', async () => {
    vi.useFakeTimers();
    vi.stubEnv('ANTI_CHEAT_AI_VERIFY_TIMEOUT_MS', '3000');
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        });
      }),
    );

    const assertion = expect(service.verify(REQUEST)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
  });
});
