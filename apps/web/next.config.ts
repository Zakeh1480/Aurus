import path from "node:path";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// O .env do monorepo fica na raiz (mesma convenção de apps/api/src/main.ts) —
// Next.js só carrega .env do diretório do próprio app por padrão.
loadEnvConfig(path.resolve(process.cwd(), "..", ".."));

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // camera=(self) preserva o uso legítimo da câmera nas partidas — não é deny-all.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
