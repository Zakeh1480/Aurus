import { z } from 'zod';

import { UserSchema } from './user.dto.js';

export const SessionUserResponseSchema = z.object({
  user: UserSchema,
});
export type SessionUserResponse = z.infer<typeof SessionUserResponseSchema>;

export const BffSessionStatusResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('unauthenticated') }),
  z.object({ status: z.literal('authenticated'), user: UserSchema }),
]);
export type BffSessionStatusResponse = z.infer<typeof BffSessionStatusResponseSchema>;
