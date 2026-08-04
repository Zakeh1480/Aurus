"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";

function AuthLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Carregando sessão…</p>
    </div>
  );
}

/**
 * Guard client-side: não há como validar autenticação num `middleware.ts`
 * aqui, porque o refresh token vive num cookie httpOnly no origin da API
 * (path `/auth`) e o access token só existe em memória no browser — o
 * middleware do Next (origin do apps/web) nunca vê nenhum dos dois.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, pathname, router]);

  if (status !== "authenticated") {
    return <AuthLoadingState />;
  }

  return <>{children}</>;
}
