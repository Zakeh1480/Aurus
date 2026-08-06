import { MATCH_DURATION_SECONDS } from '@aurafarming/shared';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';

import { ScoringService } from '../scoring/scoring.service';
import { LivekitService } from './livekit.service';

/**
 * Força o fim de uma partida MATCH_DURATION_SECONDS após Match.startedAt,
 * mesmo que os dois participantes continuem conectados na room do LiveKit.
 * Vive em LivekitModule (não ScoringModule) porque precisa de
 * LivekitService.deleteRoom — mesma dupla finalizeMatch + deleteRoom que
 * LivekitWebhookController já faz para o encerramento por participant_left,
 * só que disparada por tempo em vez de webhook. finalizeMatch é idempotente
 * (no-op se a partida não está mais "active"), então uma corrida entre este
 * timer e o webhook nunca finaliza a partida duas vezes.
 */
@Injectable()
export class MatchDurationSchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(MatchDurationSchedulerService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly scoringService: ScoringService,
    private readonly livekit: LivekitService,
  ) {}

  /**
   * Idempotente — chamado toda vez que um participante pede o token do
   * LiveKit (até 2x por partida, uma por jogador). `startedAt` vem do
   * Prisma (carimbado uma única vez em MatchmakingService.accept), então o
   * prazo é calculado a partir do início real da partida, não do momento em
   * que este método é chamado.
   */
  scheduleForMatch(matchId: string, startedAt: Date): void {
    if (this.timers.has(matchId)) return;

    const elapsedMs = Date.now() - startedAt.getTime();
    const remainingMs = Math.max(0, MATCH_DURATION_SECONDS * 1000 - elapsedMs);

    const timer = setTimeout(() => {
      this.timers.delete(matchId);
      this.fire(matchId).catch((error: unknown) => {
        this.logger.error(`Falha ao forçar fim por tempo da partida ${matchId}`, error);
      });
    }, remainingMs);
    this.timers.set(matchId, timer);
  }

  /** Chamado pelo webhook quando a partida já terminou por outro caminho (participant_left). */
  cancel(matchId: string): void {
    const timer = this.timers.get(matchId);
    if (!timer) return;
    clearTimeout(timer);
    this.timers.delete(matchId);
  }

  private async fire(matchId: string): Promise<void> {
    await this.scoringService.finalizeMatch(matchId);
    await this.livekit.deleteRoom(matchId);
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
