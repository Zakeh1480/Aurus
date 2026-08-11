import { Injectable } from '@nestjs/common';
import { AccessToken, RoomServiceClient, WebhookEvent, WebhookReceiver } from 'livekit-server-sdk';

import { getLivekitConfig, getLivekitTokenTtlSeconds, toHttpUrl } from './livekit.constants';

export interface LivekitTokenResult {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class LivekitService {
  private readonly config = getLivekitConfig();
  private readonly roomService = new RoomServiceClient(
    toHttpUrl(this.config.url),
    this.config.apiKey,
    this.config.apiSecret,
  );
  private readonly webhookReceiver = new WebhookReceiver(this.config.apiKey, this.config.apiSecret);

  get publicUrl(): string {
    return this.config.url;
  }

  async ensureRoom(roomName: string): Promise<void> {
    try {
      await this.roomService.createRoom({ name: roomName, maxParticipants: 2, emptyTimeout: 300 });
    } catch {
      return;
    }
  }

  async createToken(roomName: string, userId: string): Promise<LivekitTokenResult> {
    const ttlSeconds = getLivekitTokenTtlSeconds();
    const at = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity: userId,
      ttl: ttlSeconds,
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    const token = await at.toJwt();
    return { token, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
  }

  async deleteRoom(roomName: string): Promise<void> {
    try {
      await this.roomService.deleteRoom(roomName);
    } catch {
      return;
    }
  }

  verifyWebhook(rawBody: string, authHeader: string): Promise<WebhookEvent> {
    return this.webhookReceiver.receive(rawBody, authHeader);
  }
}
