import {
  AURA_SCORE_VERSION,
  type AuraScore,
  MatchResultSchema,
  type WsEventPayload,
} from '@aurafarming/shared';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type Profile } from '@prisma/client';

import { AntiCheatService } from '../anti-cheat/anti-cheat.service';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { PrismaService } from '../prisma/prisma.service';
import { RankingService } from '../ranking/ranking.service';
import { AiScoreClientService } from './ai-score-client.service';
import { computeForfeitOutcome, computeMatchOutcome, type MatchOutcome } from './match-outcome';
import { ScoreSampleBufferService } from './score-sample-buffer.service';
import { ScoreTickSchedulerService } from './score-tick-scheduler.service';
import { getScoringConfig } from './scoring.constants';

function neutralAuraScore(): AuraScore {
  return {
    overall: 0,
    breakdown: { posture: 0, eyeContact: 0, expression: 0, presence: 0, movement: 0 },
    version: AURA_SCORE_VERSION,
    computedAt: new Date().toISOString(),
  };
}

function runningAverage(prevAvg: number | null, prevCount: number, newValue: number): number {
  if (prevAvg === null || prevCount === 0) return newValue;
  return (prevAvg * prevCount + newValue) / (prevCount + 1);
}

interface PersistedResult {
  resultId: string;
  createdAt: Date;
  profile1: Profile;
  profile2: Profile;
}

interface PersistResultInput {
  matchId: string;
  player1Id: string;
  player2Id: string;
  score1: AuraScore;
  score2: AuraScore;
  outcome: MatchOutcome;
  winnerId: string | null;
  ratingBefore1: number;
  ratingBefore2: number;
  /** false em forfeit: a partida conta para matchesPlayed/wins/losses/rating, mas não para a média de AuraScore. */
  foldScoreIntoAverage?: boolean;
}

/**
 * Costura matchmaking -> IA -> resultado -> ranking. finalizeMatch é o único
 * ponto de entrada, chamado pelo webhook do LiveKit (participant_left) —
 * ver LivekitWebhookController.
 */
@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly antiCheatService: AntiCheatService,
    private readonly sampleBuffer: ScoreSampleBufferService,
    private readonly aiScoreClient: AiScoreClientService,
    private readonly scoreTickScheduler: ScoreTickSchedulerService,
    private readonly matchmakingService: MatchmakingService,
    private readonly rankingService: RankingService,
  ) {}

  /**
   * Idempotente: a checagem inicial de status cobre o caso comum; uma
   * segunda chamada concorrente que perca a corrida falha com P2002 no
   * `matchResult.create` (matchId é @unique) e vira no-op silencioso — a
   * primeira chamada já persistiu tudo e emitiu os eventos.
   */
  async finalizeMatch(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match || match.status !== 'active') return;

    this.scoreTickScheduler.cancel(matchId);

    const decision = await this.antiCheatService.getMatchDecision(matchId);
    if (decision.overallDecision === 'discarded') {
      this.logger.log(
        `Partida ${matchId} descartada por trust score baixo — rating/ranking não são tocados.`,
      );
      await this.matchmakingService.endActiveMatch(matchId, 'disconnected');
      return;
    }

    const [samples1, samples2] = await Promise.all([
      this.sampleBuffer.readSamples(matchId, match.player1Id),
      this.sampleBuffer.readSamples(matchId, match.player2Id),
    ]);
    if (samples1.length === 0 || samples2.length === 0) {
      this.logger.warn(
        `Partida ${matchId} sem amostras suficientes para agregação (p1=${samples1.length}, p2=${samples2.length}) — descartando.`,
      );
      await this.matchmakingService.endActiveMatch(matchId, 'disconnected');
      return;
    }

    const [score1, score2] = await Promise.all([
      this.aiScoreClient.aggregate(samples1),
      this.aiScoreClient.aggregate(samples2),
    ]);

    const participants = await this.prisma.matchParticipant.findMany({ where: { matchId } });
    const participant1 = participants.find((participant) => participant.userId === match.player1Id);
    const participant2 = participants.find((participant) => participant.userId === match.player2Id);
    if (!participant1 || !participant2) {
      throw new Error(`Partida ${matchId} não tem MatchParticipant para os dois jogadores.`);
    }

    const outcome = computeMatchOutcome(
      score1,
      score2,
      participant1.ratingBefore,
      participant2.ratingBefore,
      getScoringConfig().eloKFactor,
    );
    const winnerId =
      outcome.winnerSide === 'player1'
        ? match.player1Id
        : outcome.winnerSide === 'player2'
          ? match.player2Id
          : null;

    let persisted: PersistedResult;
    try {
      persisted = await this.persistResult({
        matchId,
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        score1,
        score2,
        outcome,
        winnerId,
        ratingBefore1: participant1.ratingBefore,
        ratingBefore2: participant2.ratingBefore,
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.warn(
          `Partida ${matchId} já foi finalizada por outra chamada concorrente — no-op.`,
        );
        return;
      }
      throw error;
    }

    await this.rankingService.recordMatchResult([
      {
        userId: match.player1Id,
        displayName: persisted.profile1.nickname,
        rating: persisted.profile1.rating,
        auraScoreAvg: persisted.profile1.auraScoreAvg ?? score1.overall,
        matchesPlayed: persisted.profile1.matchesPlayed,
      },
      {
        userId: match.player2Id,
        displayName: persisted.profile2.nickname,
        rating: persisted.profile2.rating,
        auraScoreAvg: persisted.profile2.auraScoreAvg ?? score2.overall,
        matchesPlayed: persisted.profile2.matchesPlayed,
      },
    ]);

    const endedAtIso = new Date().toISOString();
    const endPayload: WsEventPayload<'match:end'> = {
      matchId,
      endedAt: endedAtIso,
      reason: 'completed',
    };
    this.matchmakingService.emitToUser(match.player1Id, 'match:end', endPayload);
    this.matchmakingService.emitToUser(match.player2Id, 'match:end', endPayload);

    const resultPayload = MatchResultSchema.parse({
      id: persisted.resultId,
      matchId,
      player1: { userId: match.player1Id, score: score1, ratingDelta: outcome.delta1 },
      player2: { userId: match.player2Id, score: score2, ratingDelta: outcome.delta2 },
      winnerId,
      createdAt: persisted.createdAt.toISOString(),
    });
    this.matchmakingService.emitToUser(match.player1Id, 'match:result', resultPayload);
    this.matchmakingService.emitToUser(match.player2Id, 'match:result', resultPayload);
  }

  /**
   * Encerramento administrativo: quem não é `forfeitingUserId` é declarado
   * vencedor, independente de AuraScore/anti-cheat. Usado tanto pelo botão
   * de desistência (MatchForfeitGateway) quanto pelo webhook do LiveKit
   * quando um participante sai da room de uma partida ainda `active`.
   */
  async forfeitMatch(matchId: string, forfeitingUserId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match || match.status !== 'active') return;

    this.scoreTickScheduler.cancel(matchId);

    const winnerSide: 'player1' | 'player2' =
      forfeitingUserId === match.player1Id ? 'player2' : 'player1';
    const winnerId = winnerSide === 'player1' ? match.player1Id : match.player2Id;

    const participants = await this.prisma.matchParticipant.findMany({ where: { matchId } });
    const participant1 = participants.find((participant) => participant.userId === match.player1Id);
    const participant2 = participants.find((participant) => participant.userId === match.player2Id);
    if (!participant1 || !participant2) {
      throw new Error(`Partida ${matchId} não tem MatchParticipant para os dois jogadores.`);
    }

    const outcome = computeForfeitOutcome(
      participant1.ratingBefore,
      participant2.ratingBefore,
      winnerSide,
      getScoringConfig().eloKFactor,
    );

    const score1 = neutralAuraScore();
    const score2 = neutralAuraScore();

    let persisted: PersistedResult;
    try {
      persisted = await this.persistResult({
        matchId,
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        score1,
        score2,
        outcome,
        winnerId,
        ratingBefore1: participant1.ratingBefore,
        ratingBefore2: participant2.ratingBefore,
        foldScoreIntoAverage: false,
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.warn(
          `Partida ${matchId} já foi finalizada por outra chamada concorrente — no-op.`,
        );
        return;
      }
      throw error;
    }

    await this.rankingService.recordMatchResult([
      {
        userId: match.player1Id,
        displayName: persisted.profile1.nickname,
        rating: persisted.profile1.rating,
        auraScoreAvg: persisted.profile1.auraScoreAvg ?? score1.overall,
        matchesPlayed: persisted.profile1.matchesPlayed,
      },
      {
        userId: match.player2Id,
        displayName: persisted.profile2.nickname,
        rating: persisted.profile2.rating,
        auraScoreAvg: persisted.profile2.auraScoreAvg ?? score2.overall,
        matchesPlayed: persisted.profile2.matchesPlayed,
      },
    ]);

    const endedAtIso = new Date().toISOString();
    const endPayload: WsEventPayload<'match:end'> = {
      matchId,
      endedAt: endedAtIso,
      reason: 'forfeited',
    };
    this.matchmakingService.emitToUser(match.player1Id, 'match:end', endPayload);
    this.matchmakingService.emitToUser(match.player2Id, 'match:end', endPayload);

    const resultPayload = MatchResultSchema.parse({
      id: persisted.resultId,
      matchId,
      player1: { userId: match.player1Id, score: score1, ratingDelta: outcome.delta1 },
      player2: { userId: match.player2Id, score: score2, ratingDelta: outcome.delta2 },
      winnerId,
      createdAt: persisted.createdAt.toISOString(),
    });
    this.matchmakingService.emitToUser(match.player1Id, 'match:result', resultPayload);
    this.matchmakingService.emitToUser(match.player2Id, 'match:result', resultPayload);
  }

  private async persistResult(input: PersistResultInput): Promise<PersistedResult> {
    const {
      matchId,
      player1Id,
      player2Id,
      score1,
      score2,
      outcome,
      winnerId,
      ratingBefore1,
      ratingBefore2,
      foldScoreIntoAverage = true,
    } = input;

    return this.prisma.$transaction(async (tx) => {
      const profile1Before = await tx.profile.findUniqueOrThrow({ where: { userId: player1Id } });
      const profile2Before = await tx.profile.findUniqueOrThrow({ where: { userId: player2Id } });

      const rating1After = ratingBefore1 + outcome.delta1;
      const rating2After = ratingBefore2 + outcome.delta2;

      const result = await tx.matchResult.create({
        data: {
          matchId,
          player1Id,
          player1Score: score1,
          player1RatingDelta: outcome.delta1,
          player2Id,
          player2Score: score2,
          player2RatingDelta: outcome.delta2,
          winnerId,
        },
      });

      await tx.matchParticipant.update({
        where: { matchId_userId: { matchId, userId: player1Id } },
        data: { ratingAfter: rating1After },
      });
      await tx.matchParticipant.update({
        where: { matchId_userId: { matchId, userId: player2Id } },
        data: { ratingAfter: rating2After },
      });

      const profile1 = await tx.profile.update({
        where: { userId: player1Id },
        data: {
          rating: rating1After,
          matchesPlayed: profile1Before.matchesPlayed + 1,
          auraScoreAvg: foldScoreIntoAverage
            ? runningAverage(
                profile1Before.auraScoreAvg,
                profile1Before.matchesPlayed,
                score1.overall,
              )
            : profile1Before.auraScoreAvg,
          wins: profile1Before.wins + (winnerId === player1Id ? 1 : 0),
          losses: profile1Before.losses + (winnerId === player2Id ? 1 : 0),
        },
      });
      const profile2 = await tx.profile.update({
        where: { userId: player2Id },
        data: {
          rating: rating2After,
          matchesPlayed: profile2Before.matchesPlayed + 1,
          auraScoreAvg: foldScoreIntoAverage
            ? runningAverage(
                profile2Before.auraScoreAvg,
                profile2Before.matchesPlayed,
                score2.overall,
              )
            : profile2Before.auraScoreAvg,
          wins: profile2Before.wins + (winnerId === player2Id ? 1 : 0),
          losses: profile2Before.losses + (winnerId === player1Id ? 1 : 0),
        },
      });

      await tx.match.update({
        where: { id: matchId },
        data: {
          status: 'completed',
          endedAt: new Date(),
          winnerId,
          scoreVersion: score1.version,
          scorePlayer1: score1,
          scorePlayer2: score2,
        },
      });

      return { resultId: result.id, createdAt: result.createdAt, profile1, profile2 };
    });
  }
}
