export interface RatingWindowConfig {
  base: number;
  step: number;
  stepMs: number;
  max: number;
}

export function getRatingWindowConfig(): RatingWindowConfig {
  return {
    base: Number(process.env['MATCH_RATING_WINDOW_BASE'] ?? 50),
    step: Number(process.env['MATCH_RATING_WINDOW_STEP'] ?? 25),
    stepMs: Number(process.env['MATCH_RATING_WINDOW_STEP_MS'] ?? 5000),
    max: Number(process.env['MATCH_RATING_WINDOW_MAX'] ?? 400),
  };
}

export function getAcceptTimeoutMs(): number {
  return Number(process.env['MATCH_ACCEPT_TIMEOUT_MS'] ?? 10_000);
}

export function getGuardTtlMs(): number {
  return Number(process.env['MATCH_GUARD_TTL_MS'] ?? 21_600_000);
}

export function getAcceptPollIntervalMs(): number {
  return Number(process.env['MATCH_ACCEPT_POLL_INTERVAL_MS'] ?? 1000);
}

export function getWsTicketTtlSeconds(): number {
  return Number(process.env['WS_TICKET_TTL_SECONDS'] ?? 30);
}
