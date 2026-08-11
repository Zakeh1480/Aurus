import type { z } from 'zod';

import {
  MatchEndPayloadSchema,
  MatchFeaturesPayloadSchema,
  MatchForfeitPayloadSchema,
  MatchResultPayloadSchema,
  MatchScoreTickPayloadSchema,
  MatchStartPayloadSchema,
  MatchVerifyChallengePayloadSchema,
  MatchVerifyResponsePayloadSchema,
} from './match.events.js';
import {
  QueueAcceptPayloadSchema,
  QueueJoinPayloadSchema,
  QueueLeavePayloadSchema,
  QueueMatchedPayloadSchema,
} from './queue.events.js';

export const WsEventSchemas = {
  'queue:join': QueueJoinPayloadSchema,
  'queue:leave': QueueLeavePayloadSchema,
  'queue:matched': QueueMatchedPayloadSchema,
  'queue:accept': QueueAcceptPayloadSchema,
  'match:start': MatchStartPayloadSchema,
  'match:features': MatchFeaturesPayloadSchema,
  'match:score-tick': MatchScoreTickPayloadSchema,
  'match:verify-challenge': MatchVerifyChallengePayloadSchema,
  'match:verify-response': MatchVerifyResponsePayloadSchema,
  'match:end': MatchEndPayloadSchema,
  'match:result': MatchResultPayloadSchema,
  'match:forfeit': MatchForfeitPayloadSchema,
} as const;

export type WsEventName = keyof typeof WsEventSchemas;

export type WsEventPayload<E extends WsEventName> = z.infer<(typeof WsEventSchemas)[E]>;
