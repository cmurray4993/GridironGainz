import { createFileRoute } from "@tanstack/react-router";
import { FootballSimCast } from "@/components/simcast/FootballSimCast";
import { buildSimcastReplay } from "@/lib/simcast/replay";

export const Route = createFileRoute("/simcast-preview")({
  component: SimcastPreviewPage,
  head: () => ({ meta: [{ title: "SimCast Preview — Gridiron Gainz" }] }),
});

const previewReplay = buildSimcastReplay({
  gameId: "local-simcast-preview",
  homeName: "Gridiron Gainz",
  awayName: "River City Rush",
  homeScore: 24,
  awayScore: 21,
  homeOverall: 84,
  awayOverall: 82,
});

function SimcastPreviewPage() {
  if (!import.meta.env.DEV) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div>
          <h1 className="font-display text-3xl">Local preview only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Official SimCast replays appear inside completed matchups.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-2 py-4 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-sky-300">
            Local animation lab
          </div>
          <h1 className="mt-1 font-display text-3xl">Gridiron SimCast</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Responsive demonstration using reusable position art. Production replays use the locked
            cards and official score saved with each completed game.
          </p>
        </div>
        <FootballSimCast replay={previewReplay} />
      </div>
    </main>
  );
}
