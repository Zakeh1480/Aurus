import type { Role, User } from "@aurafarming/shared";
import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { ROLES_KEY } from "../decorators/roles.decorator";

/** Deve rodar depois de JwtAuthGuard no mesmo @UseGuards — lê request.user.role já populado. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<Request & { user: User }>();
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException("Você não tem permissão para acessar este recurso.");
    }
    return true;
  }
}
