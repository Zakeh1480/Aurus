"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ProfileSchema } from "@aurafarming/shared";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usersApi } from "@/lib/api-client";
import { profileQueryKey } from "@/lib/query-keys";

const profileFormSchema = z.object({
  nickname: ProfileSchema.shape.nickname,
  avatarUrl: z.union([z.url("URL inválida."), z.literal("")]),
  bio: z.string().max(280, "Máximo de 280 caracteres."),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-4">
      <span className="font-mono text-2xl text-primary">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function ProfileView() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: profileQueryKey, queryFn: usersApi.getProfile });
  const [successMessage, setSuccessMessage] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values: profileQuery.data
      ? {
          nickname: profileQuery.data.nickname,
          avatarUrl: profileQuery.data.avatarUrl ?? "",
          bio: profileQuery.data.bio ?? "",
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: usersApi.updateProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey, profile);
      setSuccessMessage(true);
    },
  });

  if (profileQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Carregando perfil…</p>;
  }

  if (!profileQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Não foi possível carregar seu perfil.</AlertDescription>
      </Alert>
    );
  }

  const profile = profileQuery.data;

  const onSubmit = handleSubmit((values) => {
    setSuccessMessage(false);
    updateMutation.mutate({
      nickname: values.nickname,
      avatarUrl: values.avatarUrl === "" ? null : values.avatarUrl,
      bio: values.bio === "" ? null : values.bio,
    });
  });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estatísticas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Rating" value={String(profile.rating)} />
          <StatCard label="Aura Score médio" value={profile.auraScoreAvg !== null ? profile.auraScoreAvg.toFixed(2) : "—"} />
          <StatCard label="Partidas" value={String(profile.matchesPlayed)} />
          <StatCard label="Vitórias / derrotas" value={`${profile.wins} / ${profile.losses}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Editar perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.nickname} />
                <AvatarFallback>{profile.nickname.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>

            {successMessage ? (
              <Alert variant="success">
                <AlertDescription>Perfil atualizado.</AlertDescription>
              </Alert>
            ) : null}
            {updateMutation.isError ? (
              <Alert variant="destructive">
                <AlertDescription>Não foi possível salvar. Tente novamente.</AlertDescription>
              </Alert>
            ) : null}

            <FormField label="Nickname" htmlFor="nickname" error={errors.nickname?.message}>
              <Input id="nickname" {...register("nickname")} />
            </FormField>

            <FormField label="URL do avatar" htmlFor="avatarUrl" error={errors.avatarUrl?.message}>
              <Input id="avatarUrl" placeholder="https://…" {...register("avatarUrl")} />
            </FormField>

            <FormField label="Bio" htmlFor="bio" error={errors.bio?.message}>
              <Textarea id="bio" rows={3} {...register("bio")} />
            </FormField>

            <Button type="submit" disabled={isSubmitting || updateMutation.isPending} className="self-start">
              {updateMutation.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
