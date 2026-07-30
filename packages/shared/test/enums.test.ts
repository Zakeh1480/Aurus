import { describe, expect, it } from "vitest";

import { MatchStatusSchema } from "../src/enums/match-status.enum.js";
import { QueueStatusSchema } from "../src/enums/queue-status.enum.js";

describe("MatchStatusSchema", () => {
  it.each(["pending", "active", "completed", "cancelled"])("aceita %s", (value) => {
    expect(MatchStatusSchema.safeParse(value).success).toBe(true);
  });

  it("rejeita um valor fora do enum", () => {
    expect(MatchStatusSchema.safeParse("archived").success).toBe(false);
  });
});

describe("QueueStatusSchema", () => {
  it.each(["idle", "queued", "matched"])("aceita %s", (value) => {
    expect(QueueStatusSchema.safeParse(value).success).toBe(true);
  });

  it("rejeita um valor fora do enum", () => {
    expect(QueueStatusSchema.safeParse("banned").success).toBe(false);
  });
});
