import { config } from 'dotenv';
import { resolve } from 'node:path';
import { AURA_SCORE_VERSION, AuraFeaturesSchema, AuraScoreSchema } from '@aurafarming/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

config({ path: resolve(process.cwd(), '../../.env') });

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter });

async function main() {
  const SEED_PASSWORD_HASH = await argon2.hash('seed-only-password-not-for-prod', {
    type: argon2.argon2id,
  });

  const [alice, bob] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'alice@example.com',
        passwordHash: SEED_PASSWORD_HASH,
        displayName: 'Alice',
        profile: {
          create: {
            nickname: 'AliceInChains',
            rating: 1050,
            auraScoreAvg: 0.82,
            matchesPlayed: 1,
            wins: 1,
            losses: 0,
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'bob@example.com',
        passwordHash: SEED_PASSWORD_HASH,
        displayName: 'Bob',
        profile: {
          create: {
            nickname: 'BobTheBuilder',
            rating: 950,
            auraScoreAvg: 0.61,
            matchesPlayed: 1,
            wins: 0,
            losses: 1,
          },
        },
      },
    }),
  ]);

  await prisma.user.create({
    data: {
      email: 'carol@example.com',
      passwordHash: SEED_PASSWORD_HASH,
      displayName: 'Carol',
      profile: {
        create: { nickname: 'CarolSings', rating: 1000 },
      },
    },
  });

  const now = new Date().toISOString();

  const aliceFeatures = AuraFeaturesSchema.parse({
    posture: 0.85,
    eyeContact: 0.8,
    expression: 0.78,
    presence: 0.84,
    movement: 0.83,
    sequence: 42,
    capturedAt: now,
  });
  const bobFeatures = AuraFeaturesSchema.parse({
    posture: 0.6,
    eyeContact: 0.58,
    expression: 0.65,
    presence: 0.6,
    movement: 0.62,
    sequence: 42,
    capturedAt: now,
  });

  const aliceScore = AuraScoreSchema.parse({
    overall: 0.82,
    breakdown: { posture: 0.85, eyeContact: 0.8, expression: 0.78, presence: 0.84, movement: 0.83 },
    version: AURA_SCORE_VERSION,
    computedAt: now,
  });
  const bobScore = AuraScoreSchema.parse({
    overall: 0.61,
    breakdown: { posture: 0.6, eyeContact: 0.58, expression: 0.65, presence: 0.6, movement: 0.62 },
    version: AURA_SCORE_VERSION,
    computedAt: now,
  });

  const startedAt = new Date(Date.now() - 5 * 60 * 1000);
  const endedAt = new Date();

  const match = await prisma.match.create({
    data: {
      player1Id: alice.id,
      player2Id: bob.id,
      status: 'completed',
      scoreVersion: AURA_SCORE_VERSION,
      featuresPlayer1: aliceFeatures,
      featuresPlayer2: bobFeatures,
      scorePlayer1: aliceScore,
      scorePlayer2: bobScore,
      winnerId: alice.id,
      startedAt,
      endedAt,
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      {
        matchId: match.id,
        userId: alice.id,
        side: 'player1',
        ratingBefore: 1000,
        ratingAfter: 1050,
      },
      { matchId: match.id, userId: bob.id, side: 'player2', ratingBefore: 1000, ratingAfter: 950 },
    ],
  });

  await prisma.matchResult.create({
    data: {
      matchId: match.id,
      player1Id: alice.id,
      player1Score: aliceScore,
      player1RatingDelta: 50,
      player2Id: bob.id,
      player2Score: bobScore,
      player2RatingDelta: -50,
      winnerId: alice.id,
    },
  });

  console.log('Seed concluído:', {
    users: [alice.email, bob.email, 'carol@example.com'],
    match: match.id,
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
