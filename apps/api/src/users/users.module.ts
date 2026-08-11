import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AvatarStorageService } from './avatar-storage.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // AuthModule: reemitir tokens/cookie ao trocar senha/e-mail (rotateSessionAfterAccountChange).
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService, AvatarStorageService],
  exports: [UsersService],
})
export class UsersModule {}
