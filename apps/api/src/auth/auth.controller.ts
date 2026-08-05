import {
  AuthResponseSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  type AuthResponse,
  type LoginRequest,
  type RegisterRequest,
  type User,
} from "@aurafarming/shared";
import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards, UsePipes } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";

import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { REFRESH_COOKIE_NAME } from "./auth.constants";
import { AuthService } from "./auth.service";
import { clearRefreshCookie, setRefreshCookie } from "./cookie.util";
import { CurrentUser } from "./decorators/current-user.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

// ThrottlerGuard é global (APP_GUARD em app.module.ts) — os @Throttle abaixo
// só apertam o limite default (20/60s) para estas rotas específicas.
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(RegisterRequestSchema))
  register(@Body() body: RegisterRequest): Promise<User> {
    return this.authService.register(body);
  }

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(LoginRequestSchema))
  async login(@Body() body: LoginRequest, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const { user, tokens, refreshToken } = await this.authService.login(body);
    setRefreshCookie(res, refreshToken);
    return AuthResponseSchema.parse({ user, tokens });
  }

  @Post("refresh")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const { user, tokens, refreshToken } = await this.authService.refresh(req.cookies?.[REFRESH_COOKIE_NAME]);
    setRefreshCookie(res, refreshToken);
    return AuthResponseSchema.parse({ user, tokens });
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ success: true }> {
    await this.authService.logout(req.cookies?.[REFRESH_COOKIE_NAME]);
    clearRefreshCookie(res);
    return { success: true };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: User): User {
    return user;
  }
}
