import { z } from 'zod';

export const SecurityEventTypeSchema = z.enum([
  'login_failed',
  'refresh_token_reuse_detected',
  'password_changed',
  'email_changed',
]);

export type SecurityEventType = z.infer<typeof SecurityEventTypeSchema>;
