import type { Metadata } from "next";

import { ProfileView } from "@/components/profile/profile-view";

export const metadata: Metadata = {
  title: "Perfil — AuraFarming",
};

export default function ProfilePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Perfil</h1>
      <ProfileView />
    </main>
  );
}
