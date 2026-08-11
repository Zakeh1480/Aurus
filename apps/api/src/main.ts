import { config } from 'dotenv';
import { resolve } from 'node:path';
import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { getCorsOptions } from './common/cors.util';
import { MatchmakingIoAdapter } from './matchmaking/matchmaking-io.adapter';

config({ path: resolve(__dirname, '../../../.env') });

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  app.set('trust proxy', 1);
  app.use(cookieParser());

  app.use(helmet());

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.enableCors(getCorsOptions());

  app.useWebSocketAdapter(new MatchmakingIoAdapter(app));
  await app.listen(process.env['PORT'] ?? 3001);
}

void bootstrap();
