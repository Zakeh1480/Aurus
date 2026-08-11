export function buildFeaturesSigningPayload(input: {
  matchId: string;
  userId: string;
  nonce: string;
  sequence: number;
  capturedAt: string;
}): string {
  return `${input.matchId}:${input.userId}:${input.nonce}:${input.sequence}:${input.capturedAt}`;
}

export function buildVerifyResponseSigningPayload(input: {
  matchId: string;
  userId: string;
  challengeId: string;
  nonce: string;
  capturedAt: string;
}): string {
  return `${input.matchId}:${input.userId}:${input.challengeId}:${input.nonce}:${input.capturedAt}`;
}
