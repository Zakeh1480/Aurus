import { describe, expect, it, vi } from "vitest";

import { activeBanWhere } from "./ban.util";

describe("activeBanWhere", () => {
  it("exige liftedAt nulo", () => {
    expect(activeBanWhere().liftedAt).toBeNull();
  });

  it("aceita expiresAt nulo (permanente) OU no futuro", () => {
    const where = activeBanWhere();
    expect(where.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]);
  });

  it("usa a hora atual como corte — não uma constante fixa de módulo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const first = activeBanWhere();
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
    const second = activeBanWhere();
    vi.useRealTimers();

    const firstGt = (first.OR as [unknown, { expiresAt: { gt: Date } }])[1].expiresAt.gt;
    const secondGt = (second.OR as [unknown, { expiresAt: { gt: Date } }])[1].expiresAt.gt;
    expect(firstGt.getTime()).not.toBe(secondGt.getTime());
  });
});
