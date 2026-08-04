import {
  type MatchFeaturesPayload,
  MatchFeaturesPayloadSchema,
  type MatchVerifyResponsePayload,
  MatchVerifyResponsePayloadSchema,
} from "@aurafarming/shared";
import { Logger } from "@nestjs/common";
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from "@nestjs/websockets";
import type { Socket } from "socket.io";

import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AiVerifyClientService } from "./ai-verify-client.service";
import { getAntiCheatConfig } from "./anti-cheat.constants";
import { FeatureBufferService } from "./feature-buffer.service";
import { buildFeaturesSigningPayload, buildVerifyResponseSigningPayload, verifyHmac } from "./hmac.util";
import { KeyframeHistoryService } from "./keyframe-history.service";
import { NonceService } from "./nonce.service";
import { SessionSecretService } from "./session-secret.service";
import { TrustScoreService } from "./trust-score.service";

/**
 * maxHttpBufferSize com headroom explícito acima do default do Socket.IO
 * (1MB) — um keyframe base64 (~300KB, teto em ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH)
 * precisa caber no payload de match:verify-response.
 */
@WebSocketGateway({ maxHttpBufferSize: 2_000_000 })
export class AntiCheatGateway {
  private readonly logger = new Logger(AntiCheatGateway.name);

  constructor(
    private readonly sessionSecretService: SessionSecretService,
    private readonly nonceService: NonceService,
    private readonly featureBufferService: FeatureBufferService,
    private readonly keyframeHistoryService: KeyframeHistoryService,
    private readonly aiVerifyClient: AiVerifyClientService,
    private readonly trustScoreService: TrustScoreService,
  ) {}

  /**
   * Nunca chama o serviço de IA aqui — só valida assinatura/nonce/janela
   * temporal e checa continuidade física. É essa ausência de chamada
   * externa que garante que o caminho normal não tem latência perceptível.
   */
  @SubscribeMessage("match:features")
  async onFeatures(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodValidationPipe(MatchFeaturesPayloadSchema)) payload: MatchFeaturesPayload,
  ): Promise<void> {
    const userId = this.requireUserId(socket, payload.userId);

    const secret = await this.sessionSecretService.get(payload.matchId, userId);
    const canonical = buildFeaturesSigningPayload({
      matchId: payload.matchId,
      userId,
      nonce: payload.nonce,
      sequence: payload.features.sequence,
      capturedAt: payload.features.capturedAt,
    });
    const signatureOk = secret !== null && verifyHmac(canonical, secret, payload.signature);
    const nonceOk = signatureOk && (await this.nonceService.consumeFeatureNonce(payload.matchId, userId, payload.nonce));
    const withinWindow = nonceOk && this.isWithinClockSkew(payload.features.capturedAt);

    if (!signatureOk || !nonceOk || !withinWindow) {
      await this.trustScoreService.recordRejectedPacket(payload.matchId, userId);
      return;
    }

    const { violated } = await this.featureBufferService.pushAndCheck(payload.matchId, userId, payload.features);
    await this.trustScoreService.recordAcceptedPacket(payload.matchId, userId, violated);
  }

  @SubscribeMessage("match:verify-response")
  async onVerifyResponse(
    @ConnectedSocket() socket: Socket,
    @MessageBody(new ZodValidationPipe(MatchVerifyResponsePayloadSchema)) payload: MatchVerifyResponsePayload,
  ): Promise<void> {
    const userId = this.requireUserId(socket, payload.userId);

    const nonceOk = await this.nonceService.consumeChallengeNonce(
      payload.matchId,
      userId,
      payload.challengeId,
      payload.nonce,
    );
    const secret = nonceOk ? await this.sessionSecretService.get(payload.matchId, userId) : null;
    const canonical = buildVerifyResponseSigningPayload({
      matchId: payload.matchId,
      userId,
      challengeId: payload.challengeId,
      nonce: payload.nonce,
      capturedAt: payload.capturedAt,
    });
    const signatureOk = secret !== null && verifyHmac(canonical, secret, payload.signature);

    if (!nonceOk || !signatureOk) {
      await this.trustScoreService.recordRejectedChallenge(payload.matchId, userId);
      return;
    }

    const isDuplicateKeyframe = await this.keyframeHistoryService.checkAndRecord(
      payload.matchId,
      userId,
      payload.keyframeBase64,
    );
    if (isDuplicateKeyframe) {
      await this.trustScoreService.recordDuplicateKeyframe(payload.matchId, userId);
    }

    try {
      const result = await this.aiVerifyClient.verify({
        matchId: payload.matchId,
        userId,
        challengeId: payload.challengeId,
        keyframeBase64: payload.keyframeBase64,
        claimedFeatures: payload.claimedFeatures,
      });
      await this.trustScoreService.recordVerifyResult(payload.matchId, userId, result);
    } catch (error: unknown) {
      this.logger.error(`Falha ao chamar /verify para match ${payload.matchId}, user ${userId}`, error);
      await this.trustScoreService.recordVerifyFailure(payload.matchId, userId);
      // Nunca relança — uma falha do serviço de IA não pode derrubar o socket nem bloquear outros handlers.
    }
  }

  /** Nunca confia em payload.userId para autorização — mesmo padrão de MatchmakingGateway.requireUserId. */
  private requireUserId(socket: Socket, payloadUserId: string): string {
    const userId = socket.data.userId as string;
    if (payloadUserId !== userId) {
      this.logger.warn(`payload.userId (${payloadUserId}) não bate com o socket autenticado (${userId})`);
    }
    return userId;
  }

  private isWithinClockSkew(capturedAt: string): boolean {
    return Math.abs(Date.now() - Date.parse(capturedAt)) <= getAntiCheatConfig().featureClockSkewMs;
  }
}
