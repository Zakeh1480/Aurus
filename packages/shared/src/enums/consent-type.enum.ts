import { z } from "zod";

export const ConsentTypeSchema = z.enum(["camera"]);

export type ConsentType = z.infer<typeof ConsentTypeSchema>;
