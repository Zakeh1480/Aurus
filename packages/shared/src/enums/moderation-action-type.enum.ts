import { z } from "zod";

/** Ação de um moderador ao resolver um Report — sempre escolha humana explícita, sem threshold automático. */
export const ModerationActionTypeSchema = z.enum(["dismissed", "warned", "banned"]);

export type ModerationActionType = z.infer<typeof ModerationActionTypeSchema>;
