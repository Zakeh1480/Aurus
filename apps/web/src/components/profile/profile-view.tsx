'use client';

import * as React from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_FILE_SIZE_BYTES,
  ProfileSchema,
} from '@aurafarming/shared';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { rankingApi, usersApi } from '@/lib/api-client';
import { profileQueryKey, rankingMeQueryKey } from '@/lib/query-keys';

const profileFormSchema = z.object({
  nickname: ProfileSchema.shape.nickname,
  bio: z.string().max(280, 'Máximo de 280 caracteres.'),
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

function validateAvatarFile(file: File): string | null {
  if (!(AVATAR_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Formato não suportado (use JPEG, PNG ou WEBP).';
  }
  if (file.size > AVATAR_MAX_FILE_SIZE_BYTES) {
    return `Arquivo maior que ${Math.floor(AVATAR_MAX_FILE_SIZE_BYTES / 1_000_000)}MB.`;
  }
  return null;
}

export function ProfileView() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: profileQueryKey, queryFn: usersApi.getProfile });
  const rankingMeQuery = useQuery({ queryKey: rankingMeQueryKey, queryFn: rankingApi.me });
  const [successMessage, setSuccessMessage] = React.useState(false);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [avatarError, setAvatarError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values: profileQuery.data
      ? {
          nickname: profileQuery.data.nickname,
          bio: profileQuery.data.bio ?? '',
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

  const avatarMutation = useMutation({
    mutationFn: usersApi.uploadAvatar,
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey, profile);
      setAvatarPreview(null);
    },
    onError: () => setAvatarError('Não foi possível enviar a foto. Tente novamente.'),
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
      bio: values.bio === '' ? null : values.bio,
    });
  });

  function onAvatarFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setAvatarError(validationError);
      return;
    }

    setAvatarError(null);
    setAvatarPreview(URL.createObjectURL(file));
    avatarMutation.mutate(file);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estatísticas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard
            label="Posição no ranking"
            value={rankingMeQuery.data?.entry ? `#${rankingMeQuery.data.entry.rank}` : '—'}
          />
          <StatCard label="Rating" value={String(profile.rating)} />
          <StatCard
            label="Aura Score médio"
            value={profile.auraScoreAvg !== null ? profile.auraScoreAvg.toFixed(2) : '—'}
          />
          <StatCard label="Partidas" value={String(profile.matchesPlayed)} />
          <StatCard label="Vitórias / derrotas" value={`${profile.wins} / ${profile.losses}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Editar perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage
                src={avatarPreview ?? profile.avatarUrl ?? undefined}
                alt={profile.nickname}
              />
              <AvatarFallback>{profile.nickname.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept={AVATAR_ALLOWED_MIME_TYPES.join(',')}
                className="hidden"
                onChange={onAvatarFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={avatarMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarMutation.isPending ? 'Enviando…' : 'Trocar foto'}
              </Button>
              {avatarError ? <p className="text-xs text-destructive">{avatarError}</p> : null}
            </div>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
              <Input id="nickname" {...register('nickname')} />
            </FormField>

            <FormField label="Bio" htmlFor="bio" error={errors.bio?.message}>
              <Textarea id="bio" rows={3} {...register('bio')} />
            </FormField>

            <Button
              type="submit"
              disabled={isSubmitting || updateMutation.isPending}
              className="self-start"
            >
              {updateMutation.isPending ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Link
        href="/configuracoes"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        Ir para configurações da conta (senha, e-mail, LGPD)
      </Link>
    </div>
  );
}
