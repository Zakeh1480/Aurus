import { z } from "zod";

/** Papel de moderação (Prompt 13). Bootstrap via MODERATION_BOOTSTRAP_EMAILS — sem UI de promoção no MVP. */
export const RoleSchema = z.enum(["user", "moderator"]);

export type Role = z.infer<typeof RoleSchema>;
