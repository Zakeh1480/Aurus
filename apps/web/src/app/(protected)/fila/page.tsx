import type { Metadata } from "next";
import { Suspense } from "react";

import { MatchmakingPanel } from "@/components/matchmaking/matchmaking-panel";

export const metadata: Metadata = {
  title: "Fila — AuraFarming",
};

export default function FilaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Suspense>
          <MatchmakingPanel />
        </Suspense>
      </div>
    </main>
  );
}
