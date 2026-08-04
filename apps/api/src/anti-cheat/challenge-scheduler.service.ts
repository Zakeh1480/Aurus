import { randomBytes, randomUUID } from "node:crypto";

import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";

import { MatchmakingService } from "../matchmaking/matchmaking.service";
import { PrismaService } from "../prisma/prisma.service";
import { getAntiCheatConfig } from "./anti-cheat.constants";
import { NonceService } from "./nonce.service";
import { TrustScoreService } from "./trust-score.service";

/**
 * Agenda 2-4 desafios (`match:verify-challenge`) POR JOGADOR, em intervalos
 * aleatórios, parando quando a partida sai de `active` ou atinge o teto de
 * segurança `maxSessionMs`. Não há campo de "duração da partida" hoje —
 * então o agendamento é por contagem-alvo + intervalo repetido, não por
 * fração de uma duração conhecida.
 *
 * Estado (`scheduled`) vive em memória — mesma limitação assumida de
 * deploy single-instance já documentada em MatchmakingService.
 */
@Injectable()
export class ChallengeSchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(ChallengeSchedulerService.name);
  private readonly scheduled = new Set<string>();
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly nonceService: NonceService,
    private readonly trustScoreService: TrustScoreService,
    private readonly matchmakingService: MatchmakingService,
  ) {}

  /** Idempotente — chamado a cada POST /matches/:id/anti-cheat-secret. */
  ensureScheduledForMatch(matchId: string, player1Id: string, player2Id: string): void {
    for (const userId of [player1Id, player2Id]) {
      const key = `${matchId}:${userId}`;
      if (this.scheduled.has(key)) continue;
      this.scheduled.add(key);

      const config = getAntiCheatConfig();
      const targetCount =
        config.challengesMin + Math.floor(Math.random() * (config.challengesMax - config.challengesMin + 1));
      this.scheduleNext(matchId, userId, targetCount, 0, Date.now());
    }
  }

  private scheduleNext(
    matchId: string,
    userId: string,
    targetCount: number,
    issuedSoFar: number,
    sessionStartedAt: number,
  ): void {
    if (issuedSoFar >= targetCount) return;

    const config = getAntiCheatConfig();
    const delay =
      config.challengeIntervalMinMs + Math.random() * (config.challengeIntervalMaxMs - config.challengeIntervalMinMs);
    if (Date.now() + delay - sessionStartedAt > config.maxSessionMs) return;

    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.fireChallenge(matchId, userId).catch((error: unknown) => {
        this.logger.error(`Falha ao emitir desafio para match ${matchId}, user ${userId}`, error);
      });
      this.scheduleNext(matchId, userId, targetCount, issuedSoFar + 1, sessionStartedAt);
    }, delay);
    this.timers.add(timer);
  }

  private async fireChallenge(matchId: string, userId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (match?.status !== "active") return; // partida encerrou — auto-encerra o agendamento

    const config = getAntiCheatConfig();
    const challengeId = randomUUID();
    const nonce = randomBytes(16).toString("base64url");
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + config.challengeTtlMs);

    await this.nonceService.issueChallengeNonce(matchId, userId, challengeId, nonce, config.challengeTtlMs);
    await this.trustScoreService.recordChallengeIssued(matchId, userId);

    this.matchmakingService.emitToUser(userId, "match:verify-challenge", {
      matchId,
      userId,
      challengeId,
      challengeType: "snapshot",
      nonce,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
