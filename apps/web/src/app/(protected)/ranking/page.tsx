import type { Metadata } from "next";
import { Suspense } from "react";

import { RankingView } from "@/components/ranking/ranking-view";

export const metadata: Metadata = {
  title: "Ranking — AuraFarming",
};

export default function RankingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-16">
      <Suspense>
        <RankingView />
      </Suspense>
    </main>
  );
}
