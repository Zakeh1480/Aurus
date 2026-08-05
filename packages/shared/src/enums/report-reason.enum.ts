import { z } from "zod";

export const ReportReasonSchema = z.enum(["cheating", "harassment", "inappropriate_camera_content", "other"]);

export type ReportReason = z.infer<typeof ReportReasonSchema>;
