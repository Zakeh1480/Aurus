import {
  ModerationActionRequestSchema,
  ReportListQuerySchema,
  SecurityEventListQuerySchema,
  type ModerationActionRequest,
  type Report,
  type ReportDetail,
  type ReportListQuery,
  type ReportListResponse,
  type SecurityEventListQuery,
  type SecurityEventListResponse,
  type User,
} from '@aurafarming/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SecurityEventService } from '../security-event/security-event.service';
import { ModerationService } from './moderation.service';

@Controller('moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('moderator')
export class ModerationController {
  constructor(
    private readonly moderationService: ModerationService,
    private readonly securityEventService: SecurityEventService,
  ) {}

  @Get('reports')
  listReports(
    @Query(new ZodValidationPipe(ReportListQuerySchema)) query: ReportListQuery,
  ): Promise<ReportListResponse> {
    return this.moderationService.listReports(query);
  }

  @Get('reports/:id')
  getReport(@Param('id', ParseUUIDPipe) id: string): Promise<ReportDetail> {
    return this.moderationService.getReport(id);
  }

  @Post('reports/:id/action')
  @HttpCode(200)
  resolveReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() moderator: User,
    @Body(new ZodValidationPipe(ModerationActionRequestSchema)) body: ModerationActionRequest,
  ): Promise<Report> {
    return this.moderationService.resolveReport(id, moderator.id, body);
  }

  @Get('security-events')
  listSecurityEvents(
    @Query(new ZodValidationPipe(SecurityEventListQuerySchema)) query: SecurityEventListQuery,
  ): Promise<SecurityEventListResponse> {
    return this.securityEventService.list(query);
  }
}
