import type { AuraScore } from '@aurafarming/shared';

export interface MatchOutcome {
  winnerSide: 'player1' | 'player2' | null;
  delta1: number;
  delta2: number;
}

function expectedScore(ratingSelf: number, ratingOther: number): number {
  return 1 / (1 + 10 ** ((ratingOther - ratingSelf) / 400));
}

function eloDeltas(
  ratingBefore1: number,
  ratingBefore2: number,
  actual1: number,
  kFactor: number,
): { delta1: number; delta2: number } {
  const actual2 = 1 - actual1;
  const delta1 = Math.round(kFactor * (actual1 - expectedScore(ratingBefore1, ratingBefore2)));
  const delta2 = Math.round(kFactor * (actual2 - expectedScore(ratingBefore2, ratingBefore1)));
  return { delta1, delta2 };
}

export function computeMatchOutcome(
  score1: AuraScore,
  score2: AuraScore,
  ratingBefore1: number,
  ratingBefore2: number,
  kFactor: number,
): MatchOutcome {
  const winnerSide: MatchOutcome['winnerSide'] =
    score1.overall === score2.overall
      ? null
      : score1.overall > score2.overall
        ? 'player1'
        : 'player2';

  const actual1 = winnerSide === 'player1' ? 1 : winnerSide === 'player2' ? 0 : 0.5;
  const { delta1, delta2 } = eloDeltas(ratingBefore1, ratingBefore2, actual1, kFactor);

  return { winnerSide, delta1, delta2 };
}

export function computeForfeitOutcome(
  ratingBefore1: number,
  ratingBefore2: number,
  winnerSide: 'player1' | 'player2',
  kFactor: number,
): MatchOutcome {
  const actual1 = winnerSide === 'player1' ? 1 : 0;
  const { delta1, delta2 } = eloDeltas(ratingBefore1, ratingBefore2, actual1, kFactor);
  return { winnerSide, delta1, delta2 };
}
