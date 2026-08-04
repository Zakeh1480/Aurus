"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { resolveQueueEntryHref } from "@/lib/queue-entry";

export function QueueEntryButton() {
  const router = useRouter();
  const session = useSession();
  const href = resolveQueueEntryHref(session);

  return (
    <Button
      size="lg"
      className="animate-glow-pulse"
      disabled={href === null}
      onClick={() => {
        if (href) {
          router.push(href);
        }
      }}
    >
      Entrar na fila
    </Button>
  );
}
