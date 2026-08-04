import path from "node:path";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// O .env do monorepo fica na raiz (mesma convenção de apps/api/src/main.ts) —
// Next.js só carrega .env do diretório do próprio app por padrão.
loadEnvConfig(path.resolve(process.cwd(), "..", ".."));

const nextConfig: NextConfig = {};

export default nextConfig;
