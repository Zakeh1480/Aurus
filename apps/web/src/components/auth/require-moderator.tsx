"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";

/**
 * Gate client-side (cosmético) — a checagem que importa é o RolesGuard
 * server-side em apps/api/src/auth/guards/roles.guard.ts. Este componente só
 * evita renderizar a UI de moderação para quem não vai conseguir usá-la.
 */
export function RequireModerator({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === "authenticated" && user?.role !== "moderator") {
      router.replace("/");
    }
  }, [status, user, router]);

  if (status !== "authenticated" || user?.role !== "moderator") {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  return <>{children}</>;
}
