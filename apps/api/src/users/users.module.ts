import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SecurityEventModule } from '../security-event/security-event.module';
import { AvatarStorageService } from './avatar-storage.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, SecurityEventModule],
  controllers: [UsersController],
  providers: [UsersService, AvatarStorageService],
  exports: [UsersService],
})
export class UsersModule {}
