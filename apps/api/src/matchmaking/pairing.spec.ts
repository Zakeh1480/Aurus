import { describe, expect, it } from 'vitest';

import { computeRatingWindow, type QueueMember, selectBestCandidate } from './pairing';

const CONFIG = { base: 50, step: 25, stepMs: 5000, max: 400 };

describe('computeRatingWindow', () => {
  it('retorna a janela base em waitMs 0', () => {
    expect(computeRatingWindow(0, CONFIG)).toBe(50);
  });

  it('cresce em degraus a cada stepMs', () => {
    expect(computeRatingWindow(4999, CONFIG)).toBe(50);
    expect(computeRatingWindow(5000, CONFIG)).toBe(75);
    expect(computeRatingWindow(12000, CONFIG)).toBe(50 + 2 * 25);
  });

  it('satura no teto configurado', () => {
    expect(computeRatingWindow(1_000_000, CONFIG)).toBe(400);
  });

  it('trata waitMs negativo como zero', () => {
    expect(computeRatingWindow(-500, CONFIG)).toBe(50);
  });
});

describe('selectBestCandidate', () => {
  const self: QueueMember = { userId: 'self', rating: 1000, waitMs: 0 };

  it('escolhe o candidato de rating mais próximo', () => {
    const candidates: QueueMember[] = [
      { userId: 'far', rating: 1040, waitMs: 0 },
      { userId: 'near', rating: 1010, waitMs: 0 },
    ];
    expect(selectBestCandidate(self, candidates, CONFIG)?.userId).toBe('near');
  });

  it('desempata a favor de quem espera há mais tempo', () => {
    const candidates: QueueMember[] = [
      { userId: 'recent', rating: 1010, waitMs: 1000 },
      { userId: 'veteran', rating: 990, waitMs: 20_000 },
    ];

    expect(selectBestCandidate(self, candidates, CONFIG)?.userId).toBe('veteran');
  });

  it('desempate final determinístico por userId', () => {
    const candidates: QueueMember[] = [
      { userId: 'zzz', rating: 1010, waitMs: 0 },
      { userId: 'aaa', rating: 990, waitMs: 0 },
    ];
    expect(selectBestCandidate(self, candidates, CONFIG)?.userId).toBe('aaa');
  });

  it('exclui a si mesmo mesmo se aparecer na lista de candidatos', () => {
    const candidates: QueueMember[] = [{ userId: 'self', rating: 1000, waitMs: 0 }];
    expect(selectBestCandidate(self, candidates, CONFIG)).toBeUndefined();
  });

  it('rejeita candidato fora da janela de ambos os lados', () => {
    const candidates: QueueMember[] = [{ userId: 'distant', rating: 1500, waitMs: 0 }];
    expect(selectBestCandidate(self, candidates, CONFIG)).toBeUndefined();
  });

  it('inclui um candidato distante quando a janela LARGA do self alcança (espera longa do self)', () => {
    const longWaitingSelf: QueueMember = { userId: 'self', rating: 1000, waitMs: 60_000 };
    const candidates: QueueMember[] = [{ userId: 'fresh', rating: 1300, waitMs: 0 }];
    expect(selectBestCandidate(longWaitingSelf, candidates, CONFIG)?.userId).toBe('fresh');
  });

  it('inclui um self recém-chegado quando a janela LARGA do candidato que espera há muito alcança', () => {
    const candidates: QueueMember[] = [{ userId: 'veteran', rating: 1300, waitMs: 60_000 }];
    expect(selectBestCandidate(self, candidates, CONFIG)?.userId).toBe('veteran');
  });
});
