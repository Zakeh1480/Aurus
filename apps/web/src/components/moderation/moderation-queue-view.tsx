"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ReportStatus } from "@aurafarming/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { moderationApi } from "@/lib/api-client";
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS } from "@/lib/moderation-labels";
import { moderationReportsQueryKey } from "@/lib/query-keys";

const STATUS_TABS: { label: string; value: ReportStatus | undefined }[] = [
  { label: "Abertas", value: "open" },
  { label: "Resolvidas", value: "resolved" },
  { label: "Todas", value: undefined },
];

export function ModerationQueueView() {
  const [status, setStatus] = React.useState<ReportStatus | undefined>("open");

  const reportsQuery = useQuery({
    queryKey: moderationReportsQueryKey(status),
    queryFn: () => moderationApi.listReports({ status, limit: 50, offset: 0 }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.label}
            size="sm"
            variant={status === tab.value ? "default" : "outline"}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {reportsQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : reportsQuery.data && reportsQuery.data.entries.length > 0 ? (
        <div className="flex flex-col gap-3">
          {reportsQuery.data.entries.map((report) => (
            <Link key={report.id} href={`/moderacao/${report.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-sm font-medium">{REPORT_REASON_LABELS[report.reason]}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={report.source === "anti_cheat" ? "secondary" : "outline"}>
                      {report.source === "anti_cheat" ? "Anti-cheat" : "Denúncia"}
                    </Badge>
                    <Badge variant={report.status === "open" ? "default" : "secondary"}>
                      {REPORT_STATUS_LABELS[report.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Usuário denunciado: {report.reportedId} · {new Date(report.createdAt).toLocaleString("pt-BR")}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma denúncia encontrada.</p>
      )}
    </div>
  );
}
