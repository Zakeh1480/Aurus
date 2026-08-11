'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { RegisterRequestSchema } from '@aurafarming/shared';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError, usersApi } from '@/lib/api-client';
import { SITE_TERMS_VERSION } from '@/lib/legal';

const registerFormSchema = RegisterRequestSchema.extend({
  passwordConfirmation: z.string().min(1, 'Confirme sua senha.'),
  acceptedTerms: z.boolean(),
})
  .refine((value) => value.password === value.passwordConfirmation, {
    message: 'As senhas não coincidem.',
    path: ['passwordConfirmation'],
  })
  .refine((value) => value.acceptedTerms, {
    message: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade.',
    path: ['acceptedTerms'],
  });

type RegisterFormValues = z.infer<typeof registerFormSchema>;

export function RegisterForm() {
  const { register: registerAccount, login, status } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { acceptedTerms: false },
  });

  const justSubmittedRef = React.useRef(false);

  React.useEffect(() => {
    if (status === 'authenticated' && !justSubmittedRef.current) {
      router.replace('/');
    }
  }, [status, router]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    justSubmittedRef.current = true;
    try {
      await registerAccount({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
      });
      await login({ email: values.email, password: values.password });

      await usersApi
        .grantConsent({ type: 'terms', termsVersion: SITE_TERMS_VERSION })
        .catch(() => undefined);
      router.push('/consentimento');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFormError('Este e-mail já está cadastrado.');
      } else {
        setFormError('Não foi possível criar sua conta. Tente novamente.');
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

      <FormField label="Nome de exibição" htmlFor="displayName" error={errors.displayName?.message}>
        <Input id="displayName" autoComplete="nickname" {...register('displayName')} />
      </FormField>

      <FormField label="E-mail" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
      </FormField>

      <FormField label="Senha" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register('password')}
        />
      </FormField>

      <FormField
        label="Confirmar senha"
        htmlFor="passwordConfirmation"
        error={errors.passwordConfirmation?.message}
      >
        <Input
          id="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          {...register('passwordConfirmation')}
        />
      </FormField>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <Controller
            control={control}
            name="acceptedTerms"
            render={({ field }) => (
              <Checkbox
                id="acceptedTerms"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
          <Label htmlFor="acceptedTerms" className="font-normal">
            Li e aceito os{' '}
            <Link
              href="/termos"
              className="text-primary underline-offset-4 hover:underline"
              target="_blank"
            >
              Termos de Uso e a Política de Privacidade
            </Link>
            .
          </Label>
        </div>
        {errors.acceptedTerms ? (
          <p className="text-xs text-destructive">{errors.acceptedTerms.message}</p>
        ) : null}
      </div>

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? 'Criando conta…' : 'Criar conta'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
