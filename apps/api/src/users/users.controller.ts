import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_FILE_SIZE_BYTES,
  AuthResponseSchema,
  ChangeEmailRequestSchema,
  UpdateProfileRequestSchema,
  ChangePasswordRequestSchema,
  type AuthResponse,
  type ChangeEmailRequest,
  type ChangePasswordRequest,
  type Profile,
  type UpdateProfileRequest,
  type User,
  type UserDataExport,
} from '@aurafarming/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { memoryStorage } from 'multer';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthService } from '../auth/auth.service';
import { setRefreshCookie } from '../auth/cookie.util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get('profile')
  getProfile(@CurrentUser() user: User): Promise<Profile> {
    return this.usersService.getProfile(user.id);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: User,

    @Body(new ZodValidationPipe(UpdateProfileRequestSchema)) body: UpdateProfileRequest,
  ): Promise<Profile> {
    return this.usersService.updateProfile(user.id, body);
  }

  @Get('export')
  exportData(@CurrentUser() user: User): Promise<UserDataExport> {
    return this.usersService.exportData(user.id);
  }

  @Delete()
  @HttpCode(200)
  async remove(@CurrentUser() user: User): Promise<{ success: true }> {
    await this.usersService.remove(user.id);
    return { success: true };
  }

  @Patch('password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changePassword(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(ChangePasswordRequestSchema)) body: ChangePasswordRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    await this.usersService.changePassword(user.id, body);
    const { tokens, refreshToken } = await this.authService.rotateSessionAfterAccountChange(
      user.id,
    );
    setRefreshCookie(res, refreshToken);
    return AuthResponseSchema.parse({ user, tokens });
  }

  @Patch('email')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changeEmail(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(ChangeEmailRequestSchema)) body: ChangeEmailRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const updatedUser = await this.usersService.changeEmail(user.id, body);
    const { tokens, refreshToken } = await this.authService.rotateSessionAfterAccountChange(
      user.id,
    );
    setRefreshCookie(res, refreshToken);
    return AuthResponseSchema.parse({ user: updatedUser, tokens });
  }

  @Post('avatar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: AVATAR_MAX_FILE_SIZE_BYTES },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<Profile> {
    if (!file) {
      throw new BadRequestException(
        `Nenhum arquivo enviado (aceita: ${AVATAR_ALLOWED_MIME_TYPES.join(', ')}).`,
      );
    }
    return this.usersService.uploadAvatar(user.id, file.buffer);
  }
}
