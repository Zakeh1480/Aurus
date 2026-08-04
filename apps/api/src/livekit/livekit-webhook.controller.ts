import { Controller, Headers, HttpCode, Post, Req, UnauthorizedException, type RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import type { WebhookEvent } from "livekit-server-sdk";

import { ScoringService } from "../scoring/scoring.service";
import { LivekitService } from "./livekit.service";

/** Sem JwtAuthGuard — a autenticação aqui é a assinatura do LiveKit no header Authorization, não um JWT de usuário. */
@Controller("livekit")
export class LivekitWebhookController {
  constructor(
    private readonly livekit: LivekitService,
    private readonly scoringService: ScoringService,
  ) {}

  @Post("webhook")
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("authorization") authHeader?: string,
  ): Promise<{ received: true }> {
    if (!authHeader || !req.rawBody) {
      throw new UnauthorizedException();
    }

    let event: WebhookEvent;
    try {
      event = await this.livekit.verifyWebhook(req.rawBody.toString("utf8"), authHeader);
    } catch {
      throw new UnauthorizedException("Assinatura de webhook inválida.");
    }

    if (event.event === "participant_left" && event.room?.name) {
      // finalizeMatch decide entre encerrar com resultado (Prompt 7) ou
      // descartar (trust score baixo/sem amostras) — encapsula o antigo
      // fallback direto para MatchmakingService.endActiveMatch.
      await this.scoringService.finalizeMatch(event.room.name);
      await this.livekit.deleteRoom(event.room.name);
    }

    return { received: true };
  }
}
