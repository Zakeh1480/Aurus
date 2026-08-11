import {
  ANTI_CHEAT_VERSION,
  type AntiCheatDecision,
  type LivenessFlagCounts,
  type MatchTrustDecision,
  MatchTrustDecisionSchema,
  type TrustAssessment,
  TrustAssessmentSchema,
  type TrustLevel,
  type VerifyResponse,
} from '@aurafarming/shared';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { getAntiCheatConfig } from './anti-cheat.constants';

const DECISION_RANK: Record<AntiCheatDecision, number> = { valid: 0, flagged: 1, discarded: 2 };

function worstDecision(a: AntiCheatDecision, b: AntiCheatDecision): AntiCheatDecision {
  return DECISION_RANK[a] >= DECISION_RANK[b] ? a : b;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

interface StatsCounters {
  discrepancySum: number;
  discrepancyCount: number;
  flagNoFaceDetected: number;
  flagStaticImageSuspected: number;
  flagLowDetailSuspected: number;
  flagMultipleFacesDetected: number;
  flagDuplicateKeyframe: number;
  challengesIssued: number;
  challengesAnswered: number;
  challengesRejected: number;
  packetsReceived: number;
  packetsRejected: number;
  temporalViolations: number;
}

@Injectable()
export class TrustScoreService {
  private readonly logger = new Logger(TrustScoreService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async recordChallengeIssued(matchId: string, userId: string): Promise<void> {
    await this.hincr(matchId, userId, 'challengesIssued', 1);
  }

  async recordRejectedChallenge(matchId: string, userId: string): Promise<void> {
    await this.hincr(matchId, userId, 'challengesAnswered', 1);
    await this.hincr(matchId, userId, 'challengesRejected', 1);
  }

  async recordVerifyResult(matchId: string, userId: string, result: VerifyResponse): Promise<void> {
    const key = this.statsKey(matchId, userId);
    await this.redis.hincrby(key, 'challengesAnswered', 1);
    await this.redis.hincrbyfloat(key, 'discrepancySum', result.discrepancy);
    await this.redis.hincrby(key, 'discrepancyCount', 1);
    if (result.liveness.noFaceDetected) await this.redis.hincrby(key, 'flagNoFaceDetected', 1);
    if (result.liveness.staticImageSuspected)
      await this.redis.hincrby(key, 'flagStaticImageSuspected', 1);
    if (result.liveness.lowDetailSuspected)
      await this.redis.hincrby(key, 'flagLowDetailSuspected', 1);
    if (result.liveness.multipleFacesDetected)
      await this.redis.hincrby(key, 'flagMultipleFacesDetected', 1);
    await this.redis.expire(key, getAntiCheatConfig().statsTtlSeconds);
  }

  async recordVerifyFailure(matchId: string, userId: string): Promise<void> {
    await this.hincr(matchId, userId, 'challengesAnswered', 1);
  }

  async recordDuplicateKeyframe(matchId: string, userId: string): Promise<void> {
    await this.hincr(matchId, userId, 'flagDuplicateKeyframe', 1);
  }

  async recordAcceptedPacket(matchId: string, userId: string, violated: boolean): Promise<void> {
    await this.hincr(matchId, userId, 'packetsReceived', 1);
    if (violated) {
      await this.hincr(matchId, userId, 'temporalViolations', 1);
    }
  }

  async recordRejectedPacket(matchId: string, userId: string): Promise<void> {
    await this.hincr(matchId, userId, 'packetsReceived', 1);
    await this.hincr(matchId, userId, 'packetsRejected', 1);
  }

  async assessParticipant(matchId: string, userId: string): Promise<TrustAssessment> {
    const config = getAntiCheatConfig();
    const counters = await this.readCounters(matchId, userId);

    const discrepancyAvg =
      counters.discrepancyCount > 0 ? counters.discrepancySum / counters.discrepancyCount : null;

    const livenessNumerator =
      counters.flagStaticImageSuspected * 1.0 +
      counters.flagDuplicateKeyframe * 1.0 +
      counters.flagNoFaceDetected * 0.8 +
      counters.flagMultipleFacesDetected * 0.6 +
      counters.flagLowDetailSuspected * 0.3 +
      counters.challengesRejected * 1.0;
    const livenessPenalty = Math.min(
      1,
      livenessNumerator / Math.max(1, counters.challengesAnswered),
    );

    const rejectedPacketRatio =
      counters.packetsReceived > 0 ? counters.packetsRejected / counters.packetsReceived : 0;

    const temporalPenalty = Math.min(
      1,
      counters.temporalViolations / config.temporalViolationSaturation,
    );

    const challengeCoverage =
      counters.challengesIssued > 0 ? counters.challengesAnswered / counters.challengesIssued : 0.5;
    const coveragePenalty = 1 - challengeCoverage;

    const trustScore = clamp01(
      1 -
        config.trustWeights.discrepancy * (discrepancyAvg ?? 0) -
        config.trustWeights.liveness * livenessPenalty -
        config.trustWeights.rejected * rejectedPacketRatio -
        config.trustWeights.temporal * temporalPenalty -
        config.trustWeights.coverage * coveragePenalty,
    );

    const trustLevel: TrustLevel =
      trustScore >= config.trustHighMin
        ? 'high'
        : trustScore < config.trustLowMax
          ? 'low'
          : 'medium';
    const decision: AntiCheatDecision =
      trustLevel === 'high' ? 'valid' : trustLevel === 'medium' ? 'flagged' : 'discarded';

    const livenessFlagCounts: LivenessFlagCounts = {
      noFaceDetectedCount: counters.flagNoFaceDetected,
      staticImageSuspectedCount: counters.flagStaticImageSuspected,
      lowDetailSuspectedCount: counters.flagLowDetailSuspected,
      multipleFacesDetectedCount: counters.flagMultipleFacesDetected,
      duplicateKeyframeCount: counters.flagDuplicateKeyframe,
    };

    return TrustAssessmentSchema.parse({
      matchId,
      userId,
      trustScore,
      trustLevel,
      decision,
      discrepancyAvg,
      livenessFlagCounts,
      rejectedPacketRatio,
      temporalViolationCount: counters.temporalViolations,
      challengesIssued: counters.challengesIssued,
      challengesAnswered: counters.challengesAnswered,
      version: ANTI_CHEAT_VERSION,
      evaluatedAt: new Date().toISOString(),
    } satisfies TrustAssessment);
  }

  async getMatchDecision(matchId: string): Promise<MatchTrustDecision> {
    const match = await this.prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    const [player1, player2] = await Promise.all([
      this.assessParticipant(matchId, match.player1Id),
      this.assessParticipant(matchId, match.player2Id),
    ]);
    const overallDecision = worstDecision(player1.decision, player2.decision);
    const evaluatedAt = new Date().toISOString();

    await this.persistIncidentIfNeeded(player1);
    await this.persistIncidentIfNeeded(player2);

    for (const assessment of [player1, player2]) {
      this.logger.log({
        event: 'anti_cheat_decision',
        matchId,
        userId: assessment.userId,
        trustScore: assessment.trustScore,
        trustLevel: assessment.trustLevel,
        decision: assessment.decision,
        version: ANTI_CHEAT_VERSION,
      });
    }

    return MatchTrustDecisionSchema.parse({
      matchId,
      player1,
      player2,
      overallDecision,
      evaluatedAt,
    });
  }

  private async persistIncidentIfNeeded(assessment: TrustAssessment): Promise<void> {
    if (assessment.decision === 'valid') return;

    const incident = await this.prisma.antiCheatIncident.upsert({
      where: { matchId_userId: { matchId: assessment.matchId, userId: assessment.userId } },
      create: {
        matchId: assessment.matchId,
        userId: assessment.userId,
        decision: assessment.decision,
        trustLevel: assessment.trustLevel,
        trustScore: assessment.trustScore,
        discrepancyAvg: assessment.discrepancyAvg,
        rejectedPacketRatio: assessment.rejectedPacketRatio,
        temporalViolationCount: assessment.temporalViolationCount,
        challengesIssued: assessment.challengesIssued,
        challengesAnswered: assessment.challengesAnswered,
        detail: { livenessFlagCounts: assessment.livenessFlagCounts },
        version: ANTI_CHEAT_VERSION,
      },
      update: {
        decision: assessment.decision,
        trustLevel: assessment.trustLevel,
        trustScore: assessment.trustScore,
        discrepancyAvg: assessment.discrepancyAvg,
        rejectedPacketRatio: assessment.rejectedPacketRatio,
        temporalViolationCount: assessment.temporalViolationCount,
        challengesIssued: assessment.challengesIssued,
        challengesAnswered: assessment.challengesAnswered,
        detail: { livenessFlagCounts: assessment.livenessFlagCounts },
        version: ANTI_CHEAT_VERSION,
      },
    });

    await this.prisma.report.upsert({
      where: { antiCheatIncidentId: incident.id },
      create: {
        reportedId: assessment.userId,
        matchId: assessment.matchId,
        antiCheatIncidentId: incident.id,
        source: 'anti_cheat',
        reason: 'cheating',
        details: `Gerado automaticamente pelo pipeline de anti-cheat (decisão: ${assessment.decision}).`,
      },
      update: {},
    });
  }

  private async hincr(
    matchId: string,
    userId: string,
    field: keyof StatsCounters,
    amount: number,
  ): Promise<void> {
    const key = this.statsKey(matchId, userId);
    await this.redis.hincrby(key, field, amount);
    await this.redis.expire(key, getAntiCheatConfig().statsTtlSeconds);
  }

  private async readCounters(matchId: string, userId: string): Promise<StatsCounters> {
    const raw = await this.redis.hgetall(this.statsKey(matchId, userId));
    const num = (field: keyof StatsCounters): number => Number(raw[field] ?? 0);
    return {
      discrepancySum: num('discrepancySum'),
      discrepancyCount: num('discrepancyCount'),
      flagNoFaceDetected: num('flagNoFaceDetected'),
      flagStaticImageSuspected: num('flagStaticImageSuspected'),
      flagLowDetailSuspected: num('flagLowDetailSuspected'),
      flagMultipleFacesDetected: num('flagMultipleFacesDetected'),
      flagDuplicateKeyframe: num('flagDuplicateKeyframe'),
      challengesIssued: num('challengesIssued'),
      challengesAnswered: num('challengesAnswered'),
      challengesRejected: num('challengesRejected'),
      packetsReceived: num('packetsReceived'),
      packetsRejected: num('packetsRejected'),
      temporalViolations: num('temporalViolations'),
    };
  }

  private statsKey(matchId: string, userId: string): string {
    return `ac:match:${matchId}:user:${userId}:stats`;
  }
}
