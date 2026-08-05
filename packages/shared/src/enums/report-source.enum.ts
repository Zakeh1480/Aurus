import { z } from "zod";

/** "anti_cheat" = criado automaticamente pelo AntiCheatModule (Prompt 6b) a partir de um incidente não-"valid". */
export const ReportSourceSchema = z.enum(["manual", "anti_cheat"]);

export type ReportSource = z.infer<typeof ReportSourceSchema>;
