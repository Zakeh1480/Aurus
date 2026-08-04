import { z } from "zod";

/** Nível de confiança do anti-cheat (Prompt 6b) — ver AntiCheatDecisionSchema para o mapeamento em decisão. */
export const TrustLevelSchema = z.enum(["high", "medium", "low"]);

export type TrustLevel = z.infer<typeof TrustLevelSchema>;
