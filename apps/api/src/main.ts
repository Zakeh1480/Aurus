import { config } from "dotenv";
import { resolve } from "node:path";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

// .env vive na raiz do monorepo (convenção do Prompt 0); compilado ou não,
// este arquivo sempre roda a partir de apps/api/{src,dist}.
config({ path: resolve(__dirname, "../../.env") });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env["PORT"] ?? 3001);
}

void bootstrap();
