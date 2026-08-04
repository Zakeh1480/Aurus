import { MatchRoom } from "@/components/match-room/match-room";

type MatchPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;
  return (
    <main className="flex min-h-screen justify-center px-6 py-10">
      <div className="w-full max-w-3xl">
        <MatchRoom matchId={id} />
      </div>
    </main>
  );
}
