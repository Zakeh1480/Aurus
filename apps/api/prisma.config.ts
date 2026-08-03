import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

// .env vive na raiz do monorepo (convenção do Prompt 0); `pnpm --filter api
// prisma ...` roda com cwd em apps/api, então apontamos explicitamente.
config({ path: resolve(process.cwd(), "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
