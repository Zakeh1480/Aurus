import { getRatingWindowConfig, type RatingWindowConfig } from './matchmaking.constants';

export interface QueueMember {
  userId: string;
  rating: number;
  waitMs: number;
}

export function computeRatingWindow(
  waitMs: number,
  config: RatingWindowConfig = getRatingWindowConfig(),
): number {
  const steps = Math.floor(Math.max(0, waitMs) / config.stepMs);
  return Math.min(config.max, config.base + steps * config.step);
}

function isEligible(
  self: QueueMember,
  candidate: QueueMember,
  config: RatingWindowConfig,
): boolean {
  const window = Math.max(
    computeRatingWindow(self.waitMs, config),
    computeRatingWindow(candidate.waitMs, config),
  );
  return Math.abs(candidate.rating - self.rating) <= window;
}

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
