import { config } from 'dotenv';
import { resolve } from 'node:path';
import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { getCorsOptions } from './common/cors.util';
import { MatchmakingIoAdapter } from './matchmaking/matchmaking-io.adapter';

// .env vive na raiz do monorepo (convenção do Prompt 0); compilado ou não,
// este arquivo sempre roda a partir de apps/api/{src,dist}, então são 3
// níveis até a raiz (dist|src -> api -> apps -> raiz).
config({ path: resolve(__dirname, '../../../.env') });

async function bootstrap() {
  // rawBody: true expõe req.rawBody (Buffer) em toda a app — necessário para
  // o LivekitWebhookController validar a assinatura do webhook, que precisa
  // do corpo bruto da requisição, não do JSON já parseado.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // Único hop de proxy reverso antes do container (Railway) — sem isso,
  // req.ip resolve pro IP do proxy, não do cliente real, e o rate-limit
  // por IP (ThrottlerGuard) vira efetivamente compartilhado entre todo
  // mundo em vez de por atacante.
  app.set('trust proxy', 1);
  app.use(cookieParser());
  // API só, sem views HTML — CSP/COEP padrão do Helmet não afetam o cliente
  // Next.js (que roda em outra origem) nem o webhook de rawBody do LiveKit.
  app.use(helmet());
  app.enableCors(getCorsOptions());
  // Depois do config() acima (env já populado) — ver matchmaking-io.adapter.ts.
  app.useWebSocketAdapter(new MatchmakingIoAdapter(app));
  await app.listen(process.env['PORT'] ?? 3001);
}

void bootstrap();
