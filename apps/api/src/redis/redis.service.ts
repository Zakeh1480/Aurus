import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

function getRedisUrl(): string {
  const url = process.env['REDIS_URL'];
  if (!url) {
    throw new Error('REDIS_URL não definido — verifique o .env na raiz do monorepo.');
  }
  return url;
}

@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    super(getRedisUrl(), { lazyConnect: true });
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
    this.logger.log('Conectado ao Redis');
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}
