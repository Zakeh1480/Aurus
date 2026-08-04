"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { usersApi } from "@/lib/api-client";
import { CAMERA_CONSENT_TERMS_VERSION, isCameraConsentGranted } from "@/lib/consent";
import { consentStatusQueryKey } from "@/lib/query-keys";

const consentFormSchema = z.object({
  accepted: z.boolean().refine((value) => value === true, "Você precisa aceitar para continuar."),
});

type ConsentFormValues = z.infer<typeof consentFormSchema>;

export function CameraConsentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const queryClient = useQueryClient();

  const statusQuery = useQuery({ queryKey: consentStatusQueryKey, queryFn: usersApi.consentStatus });

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ConsentFormValues>({
    resolver: zodResolver(consentFormSchema),
    defaultValues: { accepted: false },
  });

  const grantMutation = useMutation({
    mutationFn: () => usersApi.grantConsent({ type: "camera", termsVersion: CAMERA_CONSENT_TERMS_VERSION }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: consentStatusQueryKey });
      router.push(next ?? "/");
    },
  });

  if (statusQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  const alreadyGranted = isCameraConsentGranted(statusQuery.data ?? []);

  if (alreadyGranted) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">
          <AlertDescription>Consentimento de câmera já concedido. Você pode entrar em partidas.</AlertDescription>
        </Alert>
        <Button onClick={() => router.push(next ?? "/")}>Continuar</Button>
      </div>
    );
  }

  const onSubmit = handleSubmit(() => grantMutation.mutate());

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Suas partidas usam a câmera para que a IA analise postura, contato visual, expressão, presença e movimento e
        gere seu Aura Score. Os pontos de referência (landmarks) são extraídos no seu navegador — o vídeo bruto nunca
        sai do seu dispositivo.
      </p>

      {grantMutation.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Não foi possível registrar seu consentimento. Tente novamente.</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-start gap-2">
        <Controller
          control={control}
          name="accepted"
          render={({ field }) => (
            <Checkbox
              id="accepted"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        />
        <Label htmlFor="accepted" className="font-normal">
          Li e aceito os termos de uso da câmera (versão {CAMERA_CONSENT_TERMS_VERSION}).
        </Label>
      </div>
      {errors.accepted ? <p className="text-xs text-destructive">{errors.accepted.message}</p> : null}

      <Button type="submit" disabled={grantMutation.isPending}>
        {grantMutation.isPending ? "Registrando…" : "Aceitar e continuar"}
      </Button>
    </form>
  );
}
