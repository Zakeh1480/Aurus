import { Controller, Headers, HttpCode, Post, Req, UnauthorizedException, type RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import type { WebhookEvent } from "livekit-server-sdk";

import { MatchmakingService } from "../matchmaking/matchmaking.service";
import { LivekitService } from "./livekit.service";

/** Sem JwtAuthGuard — a autenticação aqui é a assinatura do LiveKit no header Authorization, não um JWT de usuário. */
@Controller("livekit")
export class LivekitWebhookController {
  constructor(
    private readonly livekit: LivekitService,
    private readonly matchmaking: MatchmakingService,
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
      await this.matchmaking.endActiveMatch(event.room.name, "disconnected");
      await this.livekit.deleteRoom(event.room.name);
    }

    return { received: true };
  }
}
