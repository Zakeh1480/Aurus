import { config } from "dotenv";
import { resolve } from "node:path";
import "reflect-metadata";
import cookieParser from "cookie-parser";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

// .env vive na raiz do monorepo (convenção do Prompt 0); compilado ou não,
// este arquivo sempre roda a partir de apps/api/{src,dist}, então são 3
// níveis até a raiz (dist|src -> api -> apps -> raiz).
config({ path: resolve(__dirname, "../../../.env") });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: process.env["WEB_ORIGIN"] ?? "http://localhost:3000",
    credentials: true,
  });
  await app.listen(process.env["PORT"] ?? 3001);
}

void bootstrap();
