import { z } from "zod";

/**
 * Decisão do anti-cheat (Prompt 6b) sobre o resultado de uma partida.
 * Mapeamento a partir de TrustLevel (aplicado em apps/api's TrustScoreService):
 * high -> "valid", medium -> "flagged" (revisão assíncrona), low -> "discarded"
 * (não atualiza rating/ranking).
 */
export const AntiCheatDecisionSchema = z.enum(["valid", "flagged", "discarded"]);

export type AntiCheatDecision = z.infer<typeof AntiCheatDecisionSchema>;
