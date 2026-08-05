import { z } from "zod";

/** Espelha o modelo Prisma Ban — append-only, "levantar" um ban é uma transição gravada, não uma remoção. */
export const BanSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  issuedById: z.uuid(),
  reason: z.string().min(1).max(1000),
  /** null = permanente. Duração é sempre escolha explícita do moderador — sem threshold automático. */
  expiresAt: z.iso.datetime().nullable(),
  liftedAt: z.iso.datetime().nullable(),
  liftedById: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
});

export type Ban = z.infer<typeof BanSchema>;
