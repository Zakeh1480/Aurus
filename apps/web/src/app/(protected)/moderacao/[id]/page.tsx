import type { Metadata } from "next";

import { RequireModerator } from "@/components/auth/require-moderator";
import { ReportDetailView } from "@/components/moderation/report-detail-view";

export const metadata: Metadata = {
  title: "Denúncia — AuraFarming",
};

type ModeracaoDetailPageProps = { params: Promise<{ id: string }> };

export default async function ModeracaoDetailPage({ params }: ModeracaoDetailPageProps) {
  const { id } = await params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Detalhe da denúncia</h1>
      <RequireModerator>
        <ReportDetailView reportId={id} />
      </RequireModerator>
    </main>
  );
}
