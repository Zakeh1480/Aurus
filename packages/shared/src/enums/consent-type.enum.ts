import { z } from "zod";

export const ConsentTypeSchema = z.enum(["camera", "terms"]);

export type ConsentType = z.infer<typeof ConsentTypeSchema>;
