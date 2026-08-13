import type {
  ChangeEmailRequest,
  ChangePasswordRequest,
  Profile,
  UpdateProfileRequest,
  User,
  UserDataExport,
} from '@aurafarming/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

import { toPublicUser } from '../auth/mappers/to-public-user.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventService } from '../security-event/security-event.service';
import { AvatarStorageService } from './avatar-storage.service';
import { detectImageMimeType } from './avatar-validation';
import { toProfile } from './mappers/to-profile.mapper';

const ANONYMIZED_NICKNAME = 'Jogador removido';
const ANONYMIZED_DISPLAY_NAME = 'Usuário removido';

function anonymizedEmail(userId: string): string {
  return `anon-${userId}@anonymized.aurafarming.local`;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatarStorage: AvatarStorageService,
    private readonly securityEvents: SecurityEventService,
  ) {}

  async getProfile(userId: string): Promise<Profile> {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (existing) {
      return toProfile(existing);
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    try {
      const created = await this.prisma.profile.create({
        data: { userId, nickname: user.displayName },
      });
      return toProfile(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.prisma.profile.findUniqueOrThrow({ where: { userId } });
        return toProfile(raced);
      }
      throw error;
    }
  }

  async updateProfile(userId: string, input: UpdateProfileRequest): Promise<Profile> {
    await this.getProfile(userId);
    const updated = await this.prisma.profile.update({
      where: { userId },
      data: input,
    });
    return toProfile(updated);
  }

  async exportData(userId: string): Promise<UserDataExport> {
    const [user, profile, consents, participations] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.consent.findMany({ where: { userId }, orderBy: { grantedAt: 'asc' } }),
      this.prisma.matchParticipant.findMany({
        where: { userId },
        include: { match: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      profile: profile ? toProfile(profile) : null,
      consents: consents.map((consent) => ({
        id: consent.id,
        userId: consent.userId,
        type: consent.type,
        termsVersion: consent.termsVersion,
        grantedAt: consent.grantedAt.toISOString(),
      })),
      matchHistory: participations.map((participation) => ({
        matchId: participation.matchId,
        side: participation.side,
        status: participation.match.status,
        ratingBefore: participation.ratingBefore,
        ratingAfter: participation.ratingAfter,
        startedAt: participation.match.startedAt?.toISOString() ?? null,
        endedAt: participation.match.endedAt?.toISOString() ?? null,
        createdAt: participation.match.createdAt.toISOString(),
      })),
      exportedAt: new Date().toISOString(),
    };
  }

  async remove(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail(userId),
          displayName: ANONYMIZED_DISPLAY_NAME,
          avatarUrl: null,
          anonymizedAt: new Date(),
        },
      }),
      this.prisma.profile.updateMany({
        where: { userId },
        data: { nickname: ANONYMIZED_NICKNAME, avatarUrl: null, bio: null },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async changePassword(userId: string, input: ChangePasswordRequest): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const matches = await argon2.verify(user.passwordHash, input.currentPassword);
    if (!matches) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.securityEvents.record({ type: 'password_changed', userId, metadata: null });
  }

  async changeEmail(userId: string, input: ChangeEmailRequest): Promise<User> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const matches = await argon2.verify(user.passwordHash, input.currentPassword);
    if (!matches) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { email: input.newEmail },
      });
      await this.securityEvents.record({ type: 'email_changed', userId, metadata: null });
      return toPublicUser(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('E-mail já cadastrado.');
      }
      throw error;
    }
  }

  async uploadAvatar(userId: string, file: Buffer): Promise<Profile> {
    const mimeType = detectImageMimeType(file);
    if (!mimeType) {
      throw new BadRequestException('Arquivo não é uma imagem suportada (JPEG, PNG ou WEBP).');
    }

    await this.getProfile(userId);
    const avatarUrl = await this.avatarStorage.upload(userId, file, mimeType);
    const updated = await this.prisma.profile.update({ where: { userId }, data: { avatarUrl } });
    return toProfile(updated);
  }
}
