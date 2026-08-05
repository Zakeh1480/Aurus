import type { Metadata } from "next";

import { RequireModerator } from "@/components/auth/require-moderator";
import { ModerationQueueView } from "@/components/moderation/moderation-queue-view";

export const metadata: Metadata = {
  title: "Moderação — AuraFarming",
};

export default function ModeracaoPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Fila de moderação</h1>
      <RequireModerator>
        <ModerationQueueView />
      </RequireModerator>
    </main>
  );
}
