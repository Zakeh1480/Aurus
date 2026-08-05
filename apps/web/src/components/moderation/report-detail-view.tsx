"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ModerationActionType } from "@aurafarming/shared";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { moderationApi } from "@/lib/api-client";
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS } from "@/lib/moderation-labels";
import { moderationReportDetailQueryKey, moderationReportsBaseQueryKey } from "@/lib/query-keys";

const ACTION_LABELS: Record<ModerationActionType, string> = {
  dismissed: "Descartar (sem ação)",
  warned: "Advertir usuário",
  banned: "Banir usuário",
};

type ReportDetailViewProps = { reportId: string };

export function ReportDetailView({ reportId }: ReportDetailViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const reportQuery = useQuery({
    queryKey: moderationReportDetailQueryKey(reportId),
    queryFn: () => moderationApi.getReport(reportId),
  });

  const [action, setAction] = React.useState<ModerationActionType>("dismissed");
  const [note, setNote] = React.useState("");
  const [banPermanent, setBanPermanent] = React.useState(true);
  const [banExpiresAtLocal, setBanExpiresAtLocal] = React.useState("");

  const resolveMutation = useMutation({
    mutationFn: () =>
      moderationApi.resolveReport(reportId, {
        action,
        note: note || undefined,
        banExpiresAt:
          action === "banned" ? (banPermanent ? null : new Date(banExpiresAtLocal).toISOString()) : undefined,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: moderationReportDetailQueryKey(reportId) }),
        queryClient.invalidateQueries({ queryKey: moderationReportsBaseQueryKey }),
      ]);
      router.push("/moderacao");
    },
  });

  if (reportQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (!reportQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Denúncia não encontrada.</AlertDescription>
      </Alert>
    );
  }

  const report = reportQuery.data;
  const isResolved = report.status !== "open";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-lg">{REPORT_REASON_LABELS[report.reason]}</CardTitle>
          <div className="flex gap-2">
            <Badge variant={report.source === "anti_cheat" ? "secondary" : "outline"}>
              {report.source === "anti_cheat" ? "Anti-cheat" : "Denúncia manual"}
            </Badge>
            <Badge variant={report.status === "open" ? "default" : "secondary"}>
              {REPORT_STATUS_LABELS[report.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            <span className="text-muted-foreground">Usuário denunciado:</span> {report.reportedId}
          </p>
          {report.reporterId ? (
            <p>
              <span className="text-muted-foreground">Denunciado por:</span> {report.reporterId}
            </p>
          ) : null}
          {report.matchId ? (
            <p>
              <span className="text-muted-foreground">Partida:</span> {report.matchId}
            </p>
          ) : null}
          {report.details ? (
            <p>
              <span className="text-muted-foreground">Detalhes:</span> {report.details}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Aberta em {new Date(report.createdAt).toLocaleString("pt-BR")}
          </p>
        </CardContent>
      </Card>

      {report.relatedAntiCheatIncidents.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Incidentes de anti-cheat relacionados</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {report.relatedAntiCheatIncidents.map((incident) => (
              <div key={incident.id} className="rounded-md border border-border p-3 text-xs">
                <p>
                  Decisão: <span className="font-medium">{incident.decision}</span> · Trust:{" "}
                  {incident.trustLevel} ({Math.round(incident.trustScore * 100)}%)
                </p>
                <p className="text-muted-foreground">
                  Pacotes rejeitados: {Math.round(incident.rejectedPacketRatio * 100)}% · Violações temporais:{" "}
                  {incident.temporalViolationCount} · Desafios: {incident.challengesAnswered}/
                  {incident.challengesIssued}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {isResolved ? (
        <Alert>
          <AlertDescription>
            Esta denúncia já foi resolvida ({report.action ? ACTION_LABELS[report.action] : "—"})
            {report.resolutionNote ? `: ${report.resolutionNote}` : "."}
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resolver denúncia</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {resolveMutation.isError ? (
              <Alert variant="destructive">
                <AlertDescription>Não foi possível resolver a denúncia. Tente novamente.</AlertDescription>
              </Alert>
            ) : null}

            <FormField label="Ação" htmlFor="action">
              <select
                id="action"
                value={action}
                onChange={(event) => setAction(event.target.value as ModerationActionType)}
                className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {(Object.keys(ACTION_LABELS) as ModerationActionType[]).map((value) => (
                  <option key={value} value={value}>
                    {ACTION_LABELS[value]}
                  </option>
                ))}
              </select>
            </FormField>

            {action === "banned" ? (
              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={banPermanent}
                    onChange={(event) => setBanPermanent(event.target.checked)}
                  />
                  Ban permanente
                </label>
                {!banPermanent && (
                  <FormField label="Expira em" htmlFor="banExpiresAt">
                    <Input
                      id="banExpiresAt"
                      type="datetime-local"
                      value={banExpiresAtLocal}
                      onChange={(event) => setBanExpiresAtLocal(event.target.value)}
                    />
                  </FormField>
                )}
              </div>
            ) : null}

            <FormField label="Nota (opcional)" htmlFor="note">
              <Textarea id="note" maxLength={1000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
            </FormField>

            <Button
              onClick={() => resolveMutation.mutate()}
              disabled={resolveMutation.isPending || (action === "banned" && !banPermanent && !banExpiresAtLocal)}
              variant={action === "banned" ? "destructive" : "default"}
            >
              {resolveMutation.isPending ? "Aplicando…" : "Confirmar"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
