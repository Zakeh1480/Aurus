'use client';

import * as React from 'react';

import { RequireAuth } from '@/components/auth/require-auth';
import { NavBar } from '@/components/navigation/nav-bar';
import { RankingRealtimeSync } from '@/components/ranking/ranking-realtime-sync';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RankingRealtimeSync />
      <NavBar />
      {children}
    </RequireAuth>
  );
}
