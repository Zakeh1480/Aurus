import type { Profile as PrismaProfile } from "@prisma/client";
import type { Profile } from "@aurafarming/shared";

export function toProfile(profile: PrismaProfile): Profile {
  return {
    userId: profile.userId,
    nickname: profile.nickname,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    rating: profile.rating,
    auraScoreAvg: profile.auraScoreAvg,
    matchesPlayed: profile.matchesPlayed,
    wins: profile.wins,
    losses: profile.losses,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}
