import { z } from "zod";

export const MatchSideSchema = z.enum(["player1", "player2"]);

export type MatchSide = z.infer<typeof MatchSideSchema>;
