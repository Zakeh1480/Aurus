import { z } from "zod";

export const MatchStatusSchema = z.enum(["pending", "active", "completed", "cancelled"]);

export type MatchStatus = z.infer<typeof MatchStatusSchema>;
