import type { Role } from "@aurafarming/shared";
import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/** Restringe uma rota a usuários com um dos roles listados — checado por RolesGuard. */
export const Roles = (...roles: Role[]): ReturnType<typeof SetMetadata> => SetMetadata(ROLES_KEY, roles);
