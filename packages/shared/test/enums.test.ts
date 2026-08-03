import { describe, expect, it } from "vitest";

import { ConsentTypeSchema } from "../src/enums/consent-type.enum.js";
import { MatchSideSchema } from "../src/enums/match-side.enum.js";
import { MatchStatusSchema } from "../src/enums/match-status.enum.js";
import { QueueStatusSchema } from "../src/enums/queue-status.enum.js";

describe("ConsentTypeSchema", () => {
  it.each(["camera"])("aceita %s", (value) => {
    expect(ConsentTypeSchema.safeParse(value).success).toBe(true);
  });

  it("rejeita um valor fora do enum", () => {
    expect(ConsentTypeSchema.safeParse("microphone").success).toBe(false);
  });
});

describe("MatchSideSchema", () => {
  it.each(["player1", "player2"])("aceita %s", (value) => {
    expect(MatchSideSchema.safeParse(value).success).toBe(true);
  });

  it("rejeita um valor fora do enum", () => {
    expect(MatchSideSchema.safeParse("player3").success).toBe(false);
  });
});

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
