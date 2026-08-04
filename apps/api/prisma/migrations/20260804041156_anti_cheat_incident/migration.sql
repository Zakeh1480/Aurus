-- CreateEnum
CREATE TYPE "TrustLevel" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "AntiCheatDecision" AS ENUM ('valid', 'flagged', 'discarded');

-- CreateTable
CREATE TABLE "anti_cheat_incidents" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decision" "AntiCheatDecision" NOT NULL,
    "trustLevel" "TrustLevel" NOT NULL,
    "trustScore" DOUBLE PRECISION NOT NULL,
    "discrepancyAvg" DOUBLE PRECISION,
    "rejectedPacketRatio" DOUBLE PRECISION NOT NULL,
    "temporalViolationCount" INTEGER NOT NULL,
    "challengesIssued" INTEGER NOT NULL,
    "challengesAnswered" INTEGER NOT NULL,
    "detail" JSONB NOT NULL,
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anti_cheat_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anti_cheat_incidents_userId_idx" ON "anti_cheat_incidents"("userId");

-- CreateIndex
CREATE INDEX "anti_cheat_incidents_decision_idx" ON "anti_cheat_incidents"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "anti_cheat_incidents_matchId_userId_key" ON "anti_cheat_incidents"("matchId", "userId");

-- AddForeignKey
ALTER TABLE "anti_cheat_incidents" ADD CONSTRAINT "anti_cheat_incidents_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anti_cheat_incidents" ADD CONSTRAINT "anti_cheat_incidents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
