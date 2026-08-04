import { getRatingWindowConfig, type RatingWindowConfig } from "./matchmaking.constants";

export interface QueueMember {
  userId: string;
  rating: number;
  waitMs: number;
}

/**
 * Janela de rating em degraus: base ao entrar, +step a cada stepMs de
 * espera, até o teto max. Configurável via env (matchmaking.constants.ts).
 */
export function computeRatingWindow(waitMs: number, config: RatingWindowConfig = getRatingWindowConfig()): number {
  const steps = Math.floor(Math.max(0, waitMs) / config.stepMs);
  return Math.min(config.max, config.base + steps * config.step);
}

/**
 * Usa o MAIOR dos dois raios (self e candidato) — assim quem espera há
 * mais tempo consegue puxar um recém-chegado, em vez de depender da sorte
 * de um rating quase idêntico logo de cara.
 */
function isEligible(self: QueueMember, candidate: QueueMember, config: RatingWindowConfig): boolean {
  const window = Math.max(computeRatingWindow(self.waitMs, config), computeRatingWindow(candidate.waitMs, config));
  return Math.abs(candidate.rating - self.rating) <= window;
}

/**
 * Mais próximo de rating vence; empate a favor de quem espera há mais
 * tempo (fairness); desempate final por userId, para os testes serem
 * determinísticos.
 */
export function selectBestCandidate(
  self: QueueMember,
  candidates: QueueMember[],
  config: RatingWindowConfig = getRatingWindowConfig(),
): QueueMember | undefined {
  const eligible = candidates.filter(
    (candidate) => candidate.userId !== self.userId && isEligible(self, candidate, config),
  );

  eligible.sort((a, b) => {
    const diffA = Math.abs(a.rating - self.rating);
    const diffB = Math.abs(b.rating - self.rating);
    if (diffA !== diffB) return diffA - diffB;
    if (a.waitMs !== b.waitMs) return b.waitMs - a.waitMs;
    return a.userId.localeCompare(b.userId);
  });

  return eligible[0];
}
