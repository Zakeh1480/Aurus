import {
  type RankingEntry,
  RankingEntrySchema,
  type RankingListResponse,
  RankingListResponseSchema,
  type RankingMeResponse,
  RankingMeResponseSchema,
} from "@aurafarming/shared";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { RANKING_ZSET_KEY } from "./ranking.constants";

export interface RankingResultEntry {
  userId: string;
  displayName: string;
  rating: number;
  auraScoreAvg: number;
  matchesPlayed: number;
}

interface SnapshotRow {
  userId: string;
  displayName: string;
  rating: number;
  auraScoreAvg: number;
  matchesPlayed: number;
}

/**
 * Redis (sorted set `ranking:global`) é a leitura rápida de GET /ranking;
 * RankingSnapshot no Postgres é o histórico durável e o fallback quando o
 * Redis está vazio/frio — nunca o inverso (schema.prisma documenta essa
 * direção). `rank` nunca vem de uma coluna armazenada: é sempre recalculado
 * pela ordem de leitura, já que o `rank` gravado no snapshot é só um retrato
 * daquele instante e pode ter ficado desatualizado por partidas seguintes.
 */
@Injectable()
export class RankingService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async recordMatchResult(entries: RankingResultEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.redis.zadd(RANKING_ZSET_KEY, entry.rating, entry.userId);
      const rank = await this.redis.zrevrank(RANKING_ZSET_KEY, entry.userId);

      await this.prisma.rankingSnapshot.create({
        data: {
          rank: (rank ?? 0) + 1,
          userId: entry.userId,
          displayName: entry.displayName,
          rating: entry.rating,
          auraScoreAvg: entry.auraScoreAvg,
          matchesPlayed: entry.matchesPlayed,
        },
      });
    }
  }

  async getRanking(limit: number, offset: number): Promise<RankingListResponse> {
    const total = await this.redis.zcard(RANKING_ZSET_KEY);
    const entries = total > 0 ? await this.getRankingFromRedis(limit, offset) : await this.getRankingFromPostgres(limit, offset);

    return RankingListResponseSchema.parse({
      entries,
      limit,
      offset,
      total: total > 0 ? total : await this.countSnapshotUsers(),
    });
  }

  private async getRankingFromRedis(limit: number, offset: number): Promise<RankingEntry[]> {
    const raw = await this.redis.zrevrange(RANKING_ZSET_KEY, offset, offset + limit - 1, "WITHSCORES");
    const userIds: string[] = [];
    const ratingByUser = new Map<string, number>();
    for (let i = 0; i < raw.length; i += 2) {
      const userId = raw[i];
      const rating = raw[i + 1];
      if (!userId || rating === undefined) continue;
      userIds.push(userId);
      ratingByUser.set(userId, Number(rating));
    }

    const profiles = await this.prisma.profile.findMany({ where: { userId: { in: userIds } } });
    const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));

    return userIds.map((userId, index) => {
      const profile = profileByUserId.get(userId);
      return RankingEntrySchema.parse({
        rank: offset + index + 1,
        userId,
        displayName: profile?.nickname ?? "—",
        rating: ratingByUser.get(userId) ?? profile?.rating ?? 0,
        auraScoreAvg: profile?.auraScoreAvg ?? 0,
        matchesPlayed: profile?.matchesPlayed ?? 0,
      } satisfies RankingEntry);
    });
  }

  private async getRankingFromPostgres(limit: number, offset: number): Promise<RankingEntry[]> {
    const rows = await this.prisma.$queryRaw<SnapshotRow[]>(Prisma.sql`
      SELECT "userId", "displayName", rating, "auraScoreAvg", "matchesPlayed"
      FROM (
        SELECT DISTINCT ON ("userId") "userId", "displayName", rating, "auraScoreAvg", "matchesPlayed", "snapshotAt"
        FROM ranking_snapshots
        ORDER BY "userId", "snapshotAt" DESC
      ) latest
      ORDER BY rating DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return rows.map((row, index) =>
      RankingEntrySchema.parse({
        rank: offset + index + 1,
        userId: row.userId,
        displayName: row.displayName,
        rating: row.rating,
        auraScoreAvg: row.auraScoreAvg,
        matchesPlayed: row.matchesPlayed,
      } satisfies RankingEntry),
    );
  }

  private async countSnapshotUsers(): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`SELECT COUNT(DISTINCT "userId") AS count FROM ranking_snapshots`,
    );
    return Number(rows[0]?.count ?? 0);
  }

  async getMyRanking(userId: string): Promise<RankingMeResponse> {
    const zsetTotal = await this.redis.zcard(RANKING_ZSET_KEY);
    const entry =
      zsetTotal > 0 ? await this.getMyRankingFromRedis(userId) : await this.getMyRankingFromPostgres(userId);

    return RankingMeResponseSchema.parse({ entry });
  }

  private async getMyRankingFromRedis(userId: string): Promise<RankingEntry | null> {
    const score = await this.redis.zscore(RANKING_ZSET_KEY, userId);
    if (score === null) return null;

    const zRank = await this.redis.zrevrank(RANKING_ZSET_KEY, userId);
    const profile = await this.prisma.profile.findUnique({ where: { userId } });

    return RankingEntrySchema.parse({
      rank: (zRank ?? 0) + 1,
      userId,
      displayName: profile?.nickname ?? "—",
      rating: Number(score),
      auraScoreAvg: profile?.auraScoreAvg ?? 0,
      matchesPlayed: profile?.matchesPlayed ?? 0,
    } satisfies RankingEntry);
  }

  /**
   * Mesmo cuidado de nível de empate que getRankingFromPostgres: rank é
   * "quantos têm rating estritamente maior, + 1" — aproximação aceitável
   * para o fallback frio, não uma classificação oficial de desempate.
   */
  private async getMyRankingFromPostgres(userId: string): Promise<RankingEntry | null> {
    const rows = await this.prisma.$queryRaw<Array<SnapshotRow & { rank: bigint }>>(Prisma.sql`
      WITH latest AS (
        SELECT DISTINCT ON ("userId") "userId", "displayName", rating, "auraScoreAvg", "matchesPlayed"
        FROM ranking_snapshots
        ORDER BY "userId", "snapshotAt" DESC
      )
      SELECT me."userId", me."displayName", me.rating, me."auraScoreAvg", me."matchesPlayed",
             (SELECT COUNT(*) FROM latest higher WHERE higher.rating > me.rating) + 1 AS rank
      FROM latest me
      WHERE me."userId" = ${userId}
    `);
    const row = rows[0];
    if (!row) return null;

    return RankingEntrySchema.parse({
      rank: Number(row.rank),
      userId: row.userId,
      displayName: row.displayName,
      rating: row.rating,
      auraScoreAvg: row.auraScoreAvg,
      matchesPlayed: row.matchesPlayed,
    } satisfies RankingEntry);
  }
}
