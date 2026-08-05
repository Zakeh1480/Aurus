import { CreateReportRequestSchema, type CreateReportRequest, type Report, type User } from "@aurafarming/shared";
import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ModerationService } from "./moderation.service";

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(CreateReportRequestSchema)) body: CreateReportRequest,
  ): Promise<Report> {
    return this.moderationService.createReport(user.id, body);
  }
}
