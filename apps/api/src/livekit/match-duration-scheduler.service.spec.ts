import { MATCH_DURATION_SECONDS } from '@aurafarming/shared';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScoringService } from '../scoring/scoring.service';
import { LivekitService } from './livekit.service';
import { MatchDurationSchedulerService } from './match-duration-scheduler.service';

describe('MatchDurationSchedulerService', () => {
  let scoringService: { finalizeMatch: ReturnType<typeof vi.fn> };
  let livekit: { deleteRoom: ReturnType<typeof vi.fn> };
  let service: MatchDurationSchedulerService;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    scoringService = { finalizeMatch: vi.fn().mockResolvedValue(undefined) };
    livekit = { deleteRoom: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MatchDurationSchedulerService,
        { provide: ScoringService, useValue: scoringService },
        { provide: LivekitService, useValue: livekit },
      ],
    }).compile();
    service = moduleRef.get(MatchDurationSchedulerService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('finaliza a partida e apaga a room depois de MATCH_DURATION_SECONDS a partir de startedAt', async () => {
    service.scheduleForMatch('match-1', new Date('2026-01-01T00:00:00.000Z'));

    await vi.advanceTimersByTimeAsync(MATCH_DURATION_SECONDS * 1000);

    expect(scoringService.finalizeMatch).toHaveBeenCalledWith('match-1');
    expect(livekit.deleteRoom).toHaveBeenCalledWith('match-1');
  });

  it('não dispara antes do prazo', async () => {
    service.scheduleForMatch('match-1', new Date('2026-01-01T00:00:00.000Z'));

    await vi.advanceTimersByTimeAsync(MATCH_DURATION_SECONDS * 1000 - 1000);

    expect(scoringService.finalizeMatch).not.toHaveBeenCalled();
  });

  it('desconta o tempo já passado quando startedAt é anterior ao agendamento', async () => {
    // Simula issueToken chamado 40s depois do accept() que carimbou startedAt.
    const startedAt = new Date('2026-01-01T00:00:00.000Z');
    vi.setSystemTime(new Date('2026-01-01T00:00:40.000Z'));

    service.scheduleForMatch('match-1', startedAt);
    await vi.advanceTimersByTimeAsync((MATCH_DURATION_SECONDS - 40) * 1000 - 1000);
    expect(scoringService.finalizeMatch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(scoringService.finalizeMatch).toHaveBeenCalledWith('match-1');
  });

  it('scheduleForMatch é idempotente — chamar duas vezes não agenda dois timers', async () => {
    const startedAt = new Date('2026-01-01T00:00:00.000Z');
    service.scheduleForMatch('match-1', startedAt);
    service.scheduleForMatch('match-1', startedAt);

    await vi.advanceTimersByTimeAsync(MATCH_DURATION_SECONDS * 1000);

    expect(scoringService.finalizeMatch).toHaveBeenCalledTimes(1);
  });

  it('cancel() impede o disparo (ex.: partida já finalizada via webhook)', async () => {
    service.scheduleForMatch('match-1', new Date('2026-01-01T00:00:00.000Z'));
    service.cancel('match-1');

    await vi.advanceTimersByTimeAsync(MATCH_DURATION_SECONDS * 1000);

    expect(scoringService.finalizeMatch).not.toHaveBeenCalled();
    expect(livekit.deleteRoom).not.toHaveBeenCalled();
  });

  it('cancel() em matchId desconhecido é no-op silencioso', () => {
    expect(() => service.cancel('match-inexistente')).not.toThrow();
  });
});
