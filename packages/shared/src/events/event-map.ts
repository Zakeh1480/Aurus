import type { z } from "zod";

import {
  MatchEndPayloadSchema,
  MatchFeaturesPayloadSchema,
  MatchResultPayloadSchema,
  MatchScoreTickPayloadSchema,
  MatchStartPayloadSchema,
  MatchVerifyChallengePayloadSchema,
} from "./match.events.js";
import {
  QueueJoinPayloadSchema,
  QueueLeavePayloadSchema,
  QueueMatchedPayloadSchema,
} from "./queue.events.js";

/** Mapa evento → schema — única fonte de verdade para todo evento WebSocket. */
export const WsEventSchemas = {
  "queue:join": QueueJoinPayloadSchema,
  "queue:leave": QueueLeavePayloadSchema,
  "queue:matched": QueueMatchedPayloadSchema,
  "match:start": MatchStartPayloadSchema,
  "match:features": MatchFeaturesPayloadSchema,
  "match:score-tick": MatchScoreTickPayloadSchema,
  "match:verify-challenge": MatchVerifyChallengePayloadSchema,
  "match:end": MatchEndPayloadSchema,
  "match:result": MatchResultPayloadSchema,
} as const;

export type WsEventName = keyof typeof WsEventSchemas;

export type WsEventPayload<E extends WsEventName> = z.infer<(typeof WsEventSchemas)[E]>;
