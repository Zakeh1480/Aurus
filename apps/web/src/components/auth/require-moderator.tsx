'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/components/providers/auth-provider';

export function RequireModerator({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === 'authenticated' && user?.role !== 'moderator') {
      router.replace('/');
    }
  }, [status, user, router]);

  if (status !== 'authenticated' || user?.role !== 'moderator') {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  return <>{children}</>;
}
