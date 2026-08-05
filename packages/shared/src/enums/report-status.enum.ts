import { z } from "zod";

export const ReportStatusSchema = z.enum(["open", "resolved"]);

export type ReportStatus = z.infer<typeof ReportStatusSchema>;
