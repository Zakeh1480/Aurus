"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/providers/auth-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usersApi } from "@/lib/api-client";
import { consentsQueryKey } from "@/lib/query-keys";

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SettingsView() {
  const { logout } = useAuth();
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const consentsQuery = useQuery({ queryKey: consentsQueryKey, queryFn: usersApi.listConsents });

  const exportMutation = useMutation({
    mutationFn: usersApi.exportData,
    onSuccess: (data) => downloadJson("aurafarming-dados.json", data),
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.deleteAccount,
    onSuccess: async () => {
      await logout();
      router.push("/");
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Exportar dados</CardTitle>
          <CardDescription>Baixe uma cópia de todos os seus dados (portabilidade LGPD).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {exportMutation.isError ? (
            <Alert variant="destructive">
              <AlertDescription>Não foi possível exportar seus dados. Tente novamente.</AlertDescription>
            </Alert>
          ) : null}
          <Button
            variant="outline"
            className="self-start"
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            {exportMutation.isPending ? "Gerando arquivo…" : "Baixar meus dados"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de consentimentos</CardTitle>
        </CardHeader>
        <CardContent>
          {consentsQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : consentsQuery.data && consentsQuery.data.length > 0 ? (
            <ul className="flex flex-col gap-2 text-sm">
              {consentsQuery.data.map((consent) => (
                <li key={consent.id} className="flex justify-between gap-4 rounded-md border border-border p-3">
                  <span className="capitalize">{consent.type}</span>
                  <span className="text-muted-foreground">versão {consent.termsVersion}</span>
                  <span className="text-muted-foreground">{new Date(consent.grantedAt).toLocaleString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum consentimento registrado ainda.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Zona de risco</CardTitle>
          <CardDescription>Excluir sua conta anonimiza seus dados pessoais. Essa ação não pode ser desfeita.</CardDescription>
        </CardHeader>
        <CardContent>
          {deleteMutation.isError ? (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>Não foi possível excluir sua conta. Tente novamente.</AlertDescription>
            </Alert>
          ) : null}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">Excluir conta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Excluir sua conta?</DialogTitle>
                <DialogDescription>
                  Seus dados pessoais (e-mail, nome, avatar, bio) serão anonimizados e você será desconectado
                  imediatamente. Seu histórico de partidas e ranking é preservado, sem identificar você.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                  {deleteMutation.isPending ? "Excluindo…" : "Excluir permanentemente"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
