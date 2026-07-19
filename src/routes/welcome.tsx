import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { openStarterPack, useGame } from "@/lib/game/store";
import type { Player } from "@/lib/game/types";

export const Route = createFileRoute("/welcome")({
  component: Welcome,
  head: () => ({ meta: [{ title: "Welcome — Gridiron Gainz" }] }),
});

function Welcome() {
  const navigate = useNavigate();
  const state = useGame();
  const [phase, setPhase] = useState<"idle" | "revealed">(
    state.starterPackOpened ? "revealed" : "idle",
  );
  const [pull, setPull] = useState<Player[]>([]);
  const [busy, setBusy] = useState(false);

  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      const players = await openStarterPack();
      setPull(players);
      setPhase("revealed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-10">
      <div className="text-center">
        <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">
          Franchise founded
        </div>
        <h1 className="mt-2 font-display text-5xl text-gradient-gold">Welcome, GM</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          Every dynasty starts with a pack. This one's on the house — 5 rookie cards to launch your
          roster.
        </p>
      </div>

      {phase === "idle" ? (
        <div className="mt-10 flex flex-col items-center gap-6">
          <div
            className="grid h-56 w-40 place-items-center rounded-2xl border border-primary/50 shadow-[var(--shadow-glow)]"
            style={{ backgroundImage: "var(--gradient-card-elite)" }}
          >
            <div className="text-center">
              <div className="text-5xl">🎴</div>
              <div className="mt-2 font-display text-lg text-primary-foreground">Starter Pack</div>
              <div className="text-[10px] uppercase tracking-widest text-primary-foreground/80">
                Free · 5 cards
              </div>
            </div>
          </div>
          <button
            onClick={() => void open()}
            disabled={busy}
            className="rounded-lg bg-[image:var(--gradient-gold)] px-6 py-3 font-display text-lg text-primary-foreground shadow-[var(--shadow-glow)]"
          >
            {busy ? "Opening securely…" : "Open my first pack"}
          </button>
        </div>
      ) : (
        <div className="mt-10 space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {(pull.length ? pull : state.roster.slice(-5)).map((p) => (
              <PlayerCard key={p.id} player={p} />
            ))}
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => navigate({ to: "/" })}
              className="rounded-lg bg-[image:var(--gradient-gold)] px-6 py-3 font-display text-lg text-primary-foreground shadow-[var(--shadow-glow)]"
            >
              Enter the franchise →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
