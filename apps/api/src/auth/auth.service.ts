import type { LoginRequest, RegisterRequest, User, AuthTokens } from '@aurafarming/shared';
import {
  ConflictException,
  Injectable,
  type OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

import { activeBanWhere } from '../moderation/ban.util';
import { PrismaService } from '../prisma/prisma.service';
import { getAccessTtlSeconds, getRefreshTtlSeconds } from './auth.constants';
import type { JwtPayload } from './jwt-payload.type';
import { toPublicUser } from './mappers/to-public-user.mapper';
import { generateRefreshToken, hashToken } from './token.util';

const DUMMY_PASSWORD = 'dummy-password-for-timing-safety-padding';

export interface AuthSession {
  user: User;
  tokens: AuthTokens;
  refreshToken: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHashPromise: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHashPromise = argon2.hash(DUMMY_PASSWORD);
    await this.dummyHashPromise;
  }

  async register(input: RegisterRequest): Promise<User> {
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash,
          displayName: input.displayName,
        },
      });
      return toPublicUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('E-mail já cadastrado.');
      }
      throw error;
    }
  }

  async login(input: LoginRequest): Promise<AuthSession> {
    const invalidCredentials = new UnauthorizedException('Credenciais inválidas.');
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { bansReceived: { where: activeBanWhere(), take: 1 } },
    });

    if (!user || user.anonymizedAt || user.bansReceived.length > 0) {
      await argon2.verify(await this.getDummyHash(), input.password).catch(() => false);
      throw invalidCredentials;
    }

    const passwordMatches = await argon2.verify(user.passwordHash, input.password);
    if (!passwordMatches) {
      throw invalidCredentials;
    }

    const { tokens, refreshToken } = await this.issueTokenPair(user.id);
    return { user: toPublicUser(user), tokens, refreshToken };
  }

  async refresh(rawRefreshToken: string | undefined): Promise<AuthSession> {
    const invalid = new UnauthorizedException('Refresh token inválido.');
    if (!rawRefreshToken) {
      throw invalid;
    }

    const tokenHash = hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) {
      throw invalid;
    }

    if (stored.revokedAt) {
      await this.revokeAllUserTokens(stored.userId);
      throw invalid;
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw invalid;
    }

    const claim = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claim.count === 0) {
      await this.revokeAllUserTokens(stored.userId);
      throw invalid;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      include: { bansReceived: { where: activeBanWhere(), take: 1 } },
    });
    if (!user || user.anonymizedAt || user.bansReceived.length > 0) {
      throw invalid;
    }

    const { tokens, refreshToken } = await this.issueTokenPair(user.id);
    return { user: toPublicUser(user), tokens, refreshToken };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }
    const tokenHash = hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async forceLogout(userId: string): Promise<void> {
    await this.revokeAllUserTokens(userId);
  }

  async rotateSessionAfterAccountChange(
    userId: string,
  ): Promise<{ tokens: AuthTokens; refreshToken: string }> {
    await this.revokeAllUserTokens(userId);
    return this.issueTokenPair(userId);
  }

  private async issueTokenPair(
    userId: string,
  ): Promise<{ tokens: AuthTokens; refreshToken: string }> {
    const expiresIn = getAccessTtlSeconds();
    const payload: JwtPayload = { sub: userId };
    const accessToken = this.jwtService.sign(payload, { expiresIn });

    const rawRefreshToken = generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + getRefreshTtlSeconds() * 1000),
      },
    });

    return { tokens: { accessToken, expiresIn }, refreshToken: rawRefreshToken };
  }

  private async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async getDummyHash(): Promise<string> {
    this.dummyHashPromise ??= argon2.hash(DUMMY_PASSWORD);
    return this.dummyHashPromise;
  }
}
