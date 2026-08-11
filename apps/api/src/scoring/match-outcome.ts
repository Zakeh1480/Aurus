import type { AuraScore } from '@aurafarming/shared';

export interface MatchOutcome {
  winnerSide: 'player1' | 'player2' | null;
  delta1: number;
  delta2: number;
}

/**
 * Vencedor decidido pelo AuraScore.overall (não pelo Elo — Elo só decide o
 * quanto o rating se move). Empate exato de overall → sem vencedor, Elo trata
 * como resultado 0.5/0.5 para os dois lados.
 */
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

/**
 * Elo clássico e simétrico: cada lado usa o rating do outro ANTES da
 * partida (nunca o já atualizado), e o resultado (1/0/0.5) vem do AuraScore,
 * não de vitória "externa" nenhuma — não existe placar fora do Aura Score.
 */
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

/**
 * Elo forçado: usado quando o resultado não vem do AuraScore (desistência),
 * mas de quem ficou na partida. `winnerSide` é decidido fora daqui — o
 * cálculo de delta é idêntico ao de computeMatchOutcome, só com actual1
 * fixo em 1/0 em vez de derivado de score.
 */
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
