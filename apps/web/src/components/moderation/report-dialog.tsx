'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import type { VariantProps } from 'class-variance-authority';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ReportReasonSchema, type ReportReason } from '@aurafarming/shared';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, type buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
import { reportsApi } from '@/lib/api-client';
import { REPORT_REASON_LABELS } from '@/lib/moderation-labels';

const reportFormSchema = z.object({
  reason: ReportReasonSchema,
  details: z.string().max(500).optional(),
});

type ReportFormValues = z.infer<typeof reportFormSchema>;

type ReportDialogProps = {
  reportedUserId: string;
  matchId?: string;
  defaultReason?: ReportReason;
  triggerLabel: string;
  triggerVariant?: VariantProps<typeof buttonVariants>['variant'];
};

export function ReportDialog({
  reportedUserId,
  matchId,
  defaultReason,
  triggerLabel,
  triggerVariant = 'outline',
}: ReportDialogProps) {
  const [open, setOpen] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: { reason: defaultReason ?? 'cheating', details: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: ReportFormValues) =>
      reportsApi.create({
        reportedUserId,
        matchId,
        reason: values.reason,
        details: values.details || undefined,
      }),
    onSuccess: () => {
      setOpen(false);
      reset();
    },
  });

  const onSubmit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) mutation.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant} className="w-full">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Denunciar</DialogTitle>
          <DialogDescription>
            Sua denúncia é revisada por um moderador humano — nenhuma ação é tomada automaticamente.
          </DialogDescription>
        </DialogHeader>

        {mutation.isSuccess ? (
          <Alert variant="success">
            <AlertDescription>
              Denúncia enviada. Obrigado por ajudar a manter a comunidade segura.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {mutation.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  Não foi possível enviar sua denúncia. Tente novamente.
                </AlertDescription>
              </Alert>
            ) : null}

            <FormField label="Motivo" htmlFor="reason" error={errors.reason?.message}>
              <select
                id="reason"
                className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                {...register('reason')}
              >
                {ReportReasonSchema.options.map((reason) => (
                  <option key={reason} value={reason}>
                    {REPORT_REASON_LABELS[reason]}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Detalhes (opcional)"
              htmlFor="details"
              error={errors.details?.message}
            >
              <Textarea id="details" maxLength={500} rows={3} {...register('details')} />
            </FormField>

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Enviando…' : 'Enviar denúncia'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
