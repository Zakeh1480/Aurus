import type { Metadata } from "next";

import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = {
  title: "Configurações — AuraFarming",
};

export default function SettingsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Configurações</h1>
      <SettingsView />
    </main>
  );
}
