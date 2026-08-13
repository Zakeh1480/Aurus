import { z } from 'zod';

export const GestureLabelSchema = z.enum(['moggar', 'farmarAura', 'none']);

export type GestureLabel = z.infer<typeof GestureLabelSchema>;
