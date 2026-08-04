import type { WsEventPayload } from "@aurafarming/shared";
import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";

import { MatchmakingService } from "../matchmaking/matchmaking.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiScoreClientService } from "./ai-score-client.service";
import { ScoreSampleBufferService } from "./score-sample-buffer.service";
import { getScoringConfig } from "./scoring.constants";

/**
 * Emite match:score-tick em intervalo fixo — desacopla a cadência de
 * chamadas ao serviço de IA da frequência de match:features do cliente
 * (mesmo raciocínio de ChallengeSchedulerService, mas com setInterval em vez
 * de agendamento por contagem-alvo). Estado em memória — mesma limitação de
 * deploy single-instance já assumida em MatchmakingService.
 */
@Injectable()
export class ScoreTickSchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(ScoreTickSchedulerService.name);
  private readonly intervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sampleBuffer: ScoreSampleBufferService,
    private readonly aiScoreClient: AiScoreClientService,
    private readonly matchmakingService: MatchmakingService,
  ) {}

  /** Idempotente — chamado a cada match:features recebido por MatchScoringGateway. */
  ensureScheduledForMatch(matchId: string, player1Id: string, player2Id: string): void {
    if (this.intervals.has(matchId)) return;

    const interval = setInterval(() => {
      this.tick(matchId, player1Id, player2Id).catch((error: unknown) => {
        this.logger.error(`Falha ao processar tick de score para match ${matchId}`, error);
      });
    }, getScoringConfig().tickIntervalMs);
    this.intervals.set(matchId, interval);
  }

  /** Chamado por ScoringService.finalizeMatch — para o tick antes de agregar o resultado final. */
  cancel(matchId: string): void {
    const interval = this.intervals.get(matchId);
    if (!interval) return;
    clearInterval(interval);
    this.intervals.delete(matchId);
  }

  private async tick(matchId: string, player1Id: string, player2Id: string): Promise<void> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (match?.status !== "active") {
      this.cancel(matchId);
      return;
    }

    const [features1, features2] = await Promise.all([
      this.sampleBuffer.readLatest(matchId, player1Id),
      this.sampleBuffer.readLatest(matchId, player2Id),
    ]);
    // Só emite quando os dois já mandaram pelo menos uma amostra — evita
    // ticks incompletos logo no início da partida.
    if (!features1 || !features2) return;

    const [score1, score2] = await Promise.all([
      this.aiScoreClient.score(features1),
      this.aiScoreClient.score(features2),
    ]);

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        featuresPlayer1: features1,
        featuresPlayer2: features2,
        scorePlayer1: score1,
        scorePlayer2: score2,
      },
    });

    const payload: WsEventPayload<"match:score-tick"> = {
      matchId,
      tickAt: new Date().toISOString(),
      scores: [
        { userId: player1Id, liveScore: score1.overall },
        { userId: player2Id, liveScore: score2.overall },
      ],
    };
    this.matchmakingService.emitToUser(player1Id, "match:score-tick", payload);
    this.matchmakingService.emitToUser(player2Id, "match:score-tick", payload);
  }

  onModuleDestroy(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }
}
