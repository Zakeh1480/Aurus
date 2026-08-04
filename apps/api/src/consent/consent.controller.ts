import {
  GrantConsentRequestSchema,
  type Consent,
  type ConsentStatus,
  type GrantConsentRequest,
  type User,
} from "@aurafarming/shared";
import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ConsentService } from "./consent.service";

@Controller("users/me/consents")
@UseGuards(JwtAuthGuard)
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Post()
  @HttpCode(201)
  grant(
    @CurrentUser() user: User,
    // Pipe aplicado só ao parâmetro @Body() — um @UsePipes() de método roda contra
    // TODOS os parâmetros do handler, inclusive @CurrentUser(), o que corrompia
    // `user` (validado contra GrantConsentRequestSchema, que não tem `id`/`email`).
    @Body(new ZodValidationPipe(GrantConsentRequestSchema)) body: GrantConsentRequest,
  ): Promise<Consent> {
    return this.consentService.grant(user.id, body);
  }

  @Get()
  list(@CurrentUser() user: User): Promise<Consent[]> {
    return this.consentService.list(user.id);
  }

  @Get("status")
  status(@CurrentUser() user: User): Promise<ConsentStatus[]> {
    return this.consentService.status(user.id);
  }
}
