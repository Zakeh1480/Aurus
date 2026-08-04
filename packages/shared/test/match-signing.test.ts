import { describe, expect, it } from "vitest";

import { buildFeaturesSigningPayload, buildVerifyResponseSigningPayload } from "../src/match-signing.js";

describe("buildFeaturesSigningPayload", () => {
  it("concatena matchId:userId:nonce:sequence:capturedAt", () => {
    const payload = buildFeaturesSigningPayload({
      matchId: "match-1",
      userId: "user-a",
      nonce: "nonce-1",
      sequence: 5,
      capturedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(payload).toBe("match-1:user-a:nonce-1:5:2026-01-01T00:00:00.000Z");
  });
});

describe("buildVerifyResponseSigningPayload", () => {
  it("concatena matchId:userId:challengeId:nonce:capturedAt", () => {
    const payload = buildVerifyResponseSigningPayload({
      matchId: "match-1",
      userId: "user-a",
      challengeId: "challenge-1",
      nonce: "nonce-1",
      capturedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(payload).toBe("match-1:user-a:challenge-1:nonce-1:2026-01-01T00:00:00.000Z");
  });
});
