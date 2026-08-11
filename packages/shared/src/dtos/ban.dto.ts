import { z } from 'zod';

export const BanSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  issuedById: z.uuid(),
  reason: z.string().min(1).max(1000),

  expiresAt: z.iso.datetime().nullable(),
  liftedAt: z.iso.datetime().nullable(),
  liftedById: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
});

export type Ban = z.infer<typeof BanSchema>;
