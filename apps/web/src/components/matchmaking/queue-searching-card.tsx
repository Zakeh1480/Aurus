"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type QueueSearchingCardProps = {
  onCancel: () => void;
};

export function QueueSearchingCard({ onCancel }: QueueSearchingCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Procurando adversário…</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center py-8">
        <Loader2 className="size-10 animate-spin text-primary" aria-hidden="true" />
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" onClick={onCancel}>
          Cancelar
        </Button>
      </CardFooter>
    </Card>
  );
}
