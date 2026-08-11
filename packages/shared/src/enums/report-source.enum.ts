import { z } from 'zod';

export const ReportSourceSchema = z.enum(['manual', 'anti_cheat']);

export type ReportSource = z.infer<typeof ReportSourceSchema>;
