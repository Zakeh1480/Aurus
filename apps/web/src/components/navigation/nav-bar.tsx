'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/components/providers/auth-provider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { usersApi } from '@/lib/api-client';
import { profileQueryKey } from '@/lib/query-keys';

export function NavBar() {
  const { user, logout } = useAuth();
  const profileQuery = useQuery({
    queryKey: profileQueryKey,
    queryFn: usersApi.getProfile,
    enabled: user !== null,
  });

  if (!user) return null;

  const nickname = profileQuery.data?.nickname ?? user.displayName;
  const avatarUrl = profileQuery.data?.avatarUrl ?? undefined;

  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/fila" className="text-sm font-semibold tracking-tight">
          AuraFarming
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/fila" className="text-muted-foreground hover:text-foreground">
            Fila
          </Link>
          <Link href="/ranking" className="text-muted-foreground hover:text-foreground">
            Ranking
          </Link>
          <Link
            href="/perfil"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <Avatar className="size-6">
              <AvatarImage src={avatarUrl} alt={nickname} />
              <AvatarFallback>{nickname.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            {nickname}
          </Link>
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            Sair
          </Button>
        </div>
      </nav>
    </header>
  );
}
