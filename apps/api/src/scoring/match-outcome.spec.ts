import type { AuraScore } from '@aurafarming/shared';
import { describe, expect, it } from 'vitest';

import { computeForfeitOutcome, computeMatchOutcome } from './match-outcome';

function score(overall: number): AuraScore {
  return {
    overall,
    breakdown: {
      posture: overall,
      eyeContact: overall,
      expression: overall,
      presence: overall,
      movement: overall,
    },
    version: 'aura-score-v1',
    computedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('computeMatchOutcome', () => {
  it('player1 vence com overall maior, ratings iguais: ganha kFactor/2 arredondado, player2 perde o mesmo', () => {
    const result = computeMatchOutcome(score(0.8), score(0.4), 1000, 1000, 32);
    expect(result.winnerSide).toBe('player1');
    expect(result.delta1).toBe(16);
    expect(result.delta2).toBe(-16);
  });

  it('player2 vence com overall maior', () => {
    const result = computeMatchOutcome(score(0.3), score(0.9), 1000, 1000, 32);
    expect(result.winnerSide).toBe('player2');
    expect(result.delta1).toBe(-16);
    expect(result.delta2).toBe(16);
  });

  it('empate exato de overall: sem vencedor, delta calculado com actual=0.5 para os dois', () => {
    const result = computeMatchOutcome(score(0.6), score(0.6), 1000, 1000, 32);
    expect(result.winnerSide).toBeNull();
    expect(result.delta1).toBe(0);
    expect(result.delta2).toBe(0);
  });

  it('favorito (rating maior) vencendo ganha menos que o azarão venceria', () => {
    const favoriteWins = computeMatchOutcome(score(0.9), score(0.1), 1400, 1000, 32);
    const underdogWins = computeMatchOutcome(score(0.9), score(0.1), 1000, 1400, 32);
    expect(favoriteWins.delta1).toBeLessThan(underdogWins.delta1);
  });

  it('kFactor maior amplia a magnitude do delta', () => {
    const small = computeMatchOutcome(score(0.8), score(0.2), 1000, 1000, 16);
    const large = computeMatchOutcome(score(0.8), score(0.2), 1000, 1000, 64);
    expect(Math.abs(large.delta1)).toBeGreaterThan(Math.abs(small.delta1));
  });
});

describe('computeForfeitOutcome', () => {
  it('player1 vencedor por forfeit, ratings iguais: mesmo delta de uma vitória normal (actual=1 fixo)', () => {
    const result = computeForfeitOutcome(1000, 1000, 'player1', 32);
    expect(result.winnerSide).toBe('player1');
    expect(result.delta1).toBe(16);
    expect(result.delta2).toBe(-16);
  });

  it('player2 vencedor por forfeit', () => {
    const result = computeForfeitOutcome(1000, 1000, 'player2', 32);
    expect(result.winnerSide).toBe('player2');
    expect(result.delta1).toBe(-16);
    expect(result.delta2).toBe(16);
  });

  it('azarão vencendo por forfeit ganha mais do que o favorito venceria por forfeit', () => {
    const underdogWins = computeForfeitOutcome(1000, 1400, 'player1', 32);
    const favoriteWins = computeForfeitOutcome(1400, 1000, 'player1', 32);
    expect(underdogWins.delta1).toBeGreaterThan(favoriteWins.delta1);
  });

  it('nunca resulta em winnerSide null — diferente de computeMatchOutcome, não existe empate por forfeit', () => {
    const result = computeForfeitOutcome(1000, 1000, 'player1', 32);
    expect(result.winnerSide).not.toBeNull();
  });
});
