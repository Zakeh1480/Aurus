import type { Metadata } from "next";
import { Suspense } from "react";

import { CameraConsentForm } from "@/components/consent/camera-consent-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Consentimento de câmera — AuraFarming",
};

export default function ConsentPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Consentimento de câmera</CardTitle>
          <CardDescription>Necessário para entrar em partidas com análise de Aura Score.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <CameraConsentForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
