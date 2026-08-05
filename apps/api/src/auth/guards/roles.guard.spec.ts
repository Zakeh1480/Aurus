import type { User } from "@aurafarming/shared";
import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RolesGuard } from "./roles.guard";

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "player@example.com",
    displayName: "Player One",
    avatarUrl: null,
    role: "user",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildContext(user: User): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it("permite quando a rota não declara @Roles", () => {
    vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);
    expect(guard.canActivate(buildContext(buildUser()))).toBe(true);
  });

  it("permite quando o usuário tem um dos roles exigidos", () => {
    vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["moderator"]);
    expect(guard.canActivate(buildContext(buildUser({ role: "moderator" })))).toBe(true);
  });

  it("lança ForbiddenException quando o usuário não tem o role exigido", () => {
    vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["moderator"]);
    expect(() => guard.canActivate(buildContext(buildUser({ role: "user" })))).toThrow(ForbiddenException);
  });
});
