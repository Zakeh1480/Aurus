'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { LoginRequestSchema } from '@aurafarming/shared';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError } from '@/lib/api-client';

type LoginFormValues = z.infer<typeof LoginRequestSchema>;

export function LoginForm() {
  const { login, status } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginRequestSchema),
  });

  const justSubmittedRef = React.useRef(false);

  React.useEffect(() => {
    if (status === 'authenticated' && !justSubmittedRef.current) {
      router.replace(next ?? '/');
    }
  }, [status, next, router]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    justSubmittedRef.current = true;
    try {
      await login(values);
      router.push(next ?? '/');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setFormError('E-mail ou senha inválidos.');
      } else {
        setFormError('Não foi possível entrar. Tente novamente.');
      }
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <FormField label="E-mail" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
      </FormField>

      <FormField label="Senha" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
      </FormField>

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{' '}
        <Link href="/registro" className="text-primary underline-offset-4 hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
