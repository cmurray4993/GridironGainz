import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { generatePack } from "@/lib/game/generate";
import { addPlayers, spendCoins, useGame } from "@/lib/game/store";
import { PACK_COST, PACK_SIZE, type Player } from "@/lib/game/types";

export const Route = createFileRoute("/pack")({
  component: PackPage,
  head: () => ({ meta: [{ title: "Pack Store — Fourth & Fortune" }, { name: "description", content: "Open packs and reveal player cards." }] }),
});

type Phase = "idle" | "opening" | "revealed";

function PackPage() {
  const state = useGame();
  const [phase, setPhase] = useState<Phase>("idle");
  const [pull, setPull] = useState<Player[]>([]);
  const [revealed, setRevealed] = useState(0);

  const canAfford = state.coins >= PACK_COST;

  const openPack = () => {
    if (!spendCoins(PACK_COST)) return;
    const players = generatePack(PACK_SIZE);
    setPull(players);
    setRevealed(0);
    setPhase("opening");
    // Reveal cards one after another
    players.forEach((_, i) => {
      setTimeout(() => setRevealed((r) => Math.max(r, i + 1)), 400 + i * 500);
    });
    setTimeout(() => {
      addPlayers(players);
      setPhase("revealed");
    }, 400 + players.length * 500 + 300);
  };

  const reset = () => { setPull([]); setPhase("idle"); setRevealed(0); };

  return (
    <div className="animate-float-up space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Store</div>
        <h1 className="mt-1 font-display text-3xl">Open a Pack</h1>
        <p className="text-sm text-muted-foreground">5 players per pack. Elite pulls are rare and fan magnets.</p>
      </header>

      {phase === "idle" && (
        <div className="grid place-items-center py-10">
          <button
            onClick={openPack}
            disabled={!canAfford}
            className="group relative"
          >
            <div className={`relative h-80 w-56 overflow-hidden rounded-2xl border border-primary/40 bg-[image:var(--gradient-card-elite)] shadow-[var(--shadow-card)] transition-transform ${canAfford ? "group-hover:-translate-y-2 animate-pulse-glow" : "opacity-60"}`}>
              <div className="absolute inset-0 shimmer-overlay opacity-60" />
              <div className="absolute inset-2 rounded-xl bg-background/70 grid place-items-center text-center p-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.4em] text-primary/80">Fourth &amp; Fortune</div>
                  <div className="mt-2 font-display text-5xl text-gradient-gold">Pack</div>
                  <div className="mt-4 text-6xl">🎴</div>
                  <div className="mt-4 text-xs text-muted-foreground">{PACK_SIZE} cards</div>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-full bg-primary px-5 py-2 font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
              {canAfford ? `Open pack — 🪙 ${PACK_COST}` : `Need 🪙 ${PACK_COST}`}
            </div>
          </button>
          {!canAfford && (
            <p className="mt-4 text-xs text-muted-foreground max-w-xs text-center">
              Sign more fans and let coins accumulate, or win a game to top up.
            </p>
          )}
        </div>
      )}

      {(phase === "opening" || phase === "revealed") && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {pull.map((p, i) => (
              <div key={p.id} className="min-h-[210px]">
                {i < revealed ? (
                  <div className="animate-card-reveal">
                    <PlayerCard player={p} />
                  </div>
                ) : (
                  <div className="h-full min-h-[200px] rounded-xl border border-primary/30 bg-[image:var(--gradient-card-elite)] relative overflow-hidden">
                    <div className="absolute inset-2 rounded-lg bg-background/70 grid place-items-center">
                      <div className="text-4xl opacity-60">🎴</div>
                    </div>
                    <div className="absolute inset-0 shimmer-overlay" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {phase === "revealed" && (
            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={reset} className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm hover:bg-secondary/70">
                Back to store
              </button>
              <button onClick={openPack} disabled={!canAfford} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                Open another (🪙 {PACK_COST})
              </button>
              <Link to="/roster" className="rounded-lg border border-border bg-background px-4 py-2 text-sm">View roster</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
