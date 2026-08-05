import { z } from "zod";

import { RoleSchema } from "../enums/role.enum.js";

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().min(1).max(32),
  avatarUrl: z.url().nullable(),
  role: RoleSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type User = z.infer<typeof UserSchema>;
