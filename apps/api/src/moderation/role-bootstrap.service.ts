import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { getModerationBootstrapEmails } from './moderation.constants';

@Injectable()
export class RoleBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(RoleBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const emails = getModerationBootstrapEmails();
    if (emails.length === 0) return;

    const result = await this.prisma.user.updateMany({
      where: { email: { in: emails }, role: 'user' },
      data: { role: 'moderator' },
    });
    if (result.count > 0) {
      this.logger.log(
        `${result.count} usuário(s) promovido(s) a moderator via MODERATION_BOOTSTRAP_EMAILS.`,
      );
    }
  }
}
