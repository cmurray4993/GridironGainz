import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { generateBackyardHeroPack, generatePack, generatePositionPack, generateProPack } from "@/lib/game/generate";
import { addPlayers, spendCoins, useGame } from "@/lib/game/store";
import { BACKYARD_HERO_PACK_COST, PACK_COST, PACK_SIZE, POSITION_PACK_COST, POSITIONS, PRO_PACK_COST, type Player, type Position } from "@/lib/game/types";

export const Route = createFileRoute("/pack")({
  component: PackPage,
  head: () => ({ meta: [{ title: "Pack Store — Fourth & Fortune" }, { name: "description", content: "Open packs and reveal player cards." }] }),
});

type Phase = "idle" | "opening" | "revealed";
type PackKind = "standard" | "position" | "pro" | "backyard";

const PACK_META: Record<PackKind, { name: string; cost: number; blurb: string; gradient: string; emoji: string; tag?: string }> = {
  standard: {
    name: "Standard Pack",
    cost: PACK_COST,
    blurb: "5 players. Elite pulls are rare.",
    gradient: "var(--gradient-card-elite)",
    emoji: "🎴",
  },
  position: {
    name: "Position Pack",
    cost: POSITION_PACK_COST,
    blurb: "Pick a position. 1 player. 5% Gold, 1% Elite.",
    gradient: "var(--gradient-card-elite)",
    emoji: "🎯",
    tag: "Targeted",
  },
  pro: {
    name: "Pro Pack",
    cost: PRO_PACK_COST,
    blurb: "3 Bronze+, 1 Silver+, 1 Gold+ guaranteed.",
    gradient: "var(--gradient-card-elite)",
    emoji: "💎",
  },
  backyard: {
    name: "Backyard Heroes",
    cost: BACKYARD_HERO_PACK_COST,
    blurb: "4 cards: 1 Bronze+, 2 Silver+, 1 Gold+. High chance at a signature promo.",
    gradient: "var(--gradient-card-elite)",
    emoji: "🏆",
    tag: "Promo — Program I",
  },
};

function PackPage() {
  const state = useGame();
  const [phase, setPhase] = useState<Phase>("idle");
  const [pull, setPull] = useState<Player[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [lastKind, setLastKind] = useState<PackKind>("standard");
  const [lastPosition, setLastPosition] = useState<Position>("QB");
  const [pickerOpen, setPickerOpen] = useState(false);

  const openPack = (kind: PackKind, position?: Position) => {
    const cost = PACK_META[kind].cost;
    if (state.coins < cost) return;
    if (kind === "position" && !position) { setPickerOpen(true); return; }
    if (!spendCoins(cost)) return;
    const players =
      kind === "pro" ? generateProPack() :
      kind === "backyard" ? generateBackyardHeroPack() :
      kind === "position" ? generatePositionPack(position as Position) :
      generatePack(PACK_SIZE);
    setPull(players);
    setRevealed(0);
    setLastKind(kind);
    if (position) setLastPosition(position);
    setPickerOpen(false);
    setPhase("opening");
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
        <h1 className="mt-1 font-display text-3xl">Pack Store</h1>
        <p className="text-sm text-muted-foreground">Choose your pack. Bigger risk, bigger pulls.</p>
      </header>

      {phase === "idle" && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(["standard", "position", "pro", "backyard"] as PackKind[]).map((kind) => {
            const meta = PACK_META[kind];
            const canAfford = state.coins >= meta.cost;
            const isPromo = kind === "backyard";
            return (
              <button
                key={kind}
                onClick={() => openPack(kind)}
                disabled={!canAfford}
                className="group relative text-left"
              >
                <div className={`relative h-72 w-full overflow-hidden rounded-2xl border ${isPromo ? "border-primary" : kind === "pro" ? "border-primary/60" : "border-primary/40"} bg-[image:var(--gradient-card-elite)] shadow-[var(--shadow-card)] transition-transform ${canAfford ? "group-hover:-translate-y-1 animate-pulse-glow" : "opacity-60"}`}>
                  <div className="absolute inset-0 shimmer-overlay opacity-60" />
                  {isPromo && (
                    <div className="absolute left-2 top-2 z-10 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary-foreground">
                      Limited
                    </div>
                  )}
                  <div className="absolute inset-2 rounded-xl bg-background/70 p-4 flex flex-col items-center justify-center text-center">
                    <div className="text-[10px] uppercase tracking-[0.4em] text-primary/80">
                      {meta.tag ?? (kind === "pro" ? "Premium" : "Fourth & Fortune")}
                    </div>
                    <div className="mt-2 font-display text-3xl text-gradient-gold">{meta.name}</div>
                    <div className="mt-3 text-5xl">{meta.emoji}</div>
                    <div className="mt-3 text-xs text-muted-foreground px-3">{meta.blurb}</div>
                  </div>
                </div>
                <div className={`mt-3 rounded-full px-5 py-2 text-center font-semibold shadow-[var(--shadow-glow)] ${canAfford ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  {canAfford ? `Open — 🪙 ${meta.cost.toLocaleString()}` : `Need 🪙 ${meta.cost.toLocaleString()}`}
                </div>
              </button>
            );
          })}
        </div>
      )}


      {(phase === "opening" || phase === "revealed") && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {pull.map((p, i) => {
              const isRare = p.rarity === "gold" || p.rarity === "elite";
              return (
                <div key={p.id} className="min-h-[210px] relative">
                  {i < revealed ? (
                    <div className={isRare ? "animate-rare-reveal relative" : "animate-card-reveal"}>
                      {isRare && (
                        <>
                          <div className="pointer-events-none absolute -inset-6 rare-rays-layer" />
                          <div className="pointer-events-none absolute -inset-4 rare-flash-layer" />
                        </>
                      )}
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
              );
            })}
          </div>


          {phase === "revealed" && (
            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={reset} className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm hover:bg-secondary/70">
                Back to store
              </button>
              <button
                onClick={() => openPack(lastKind, lastKind === "position" ? lastPosition : undefined)}
                disabled={state.coins < PACK_META[lastKind].cost}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Open another {PACK_META[lastKind].name}{lastKind === "position" ? ` (${lastPosition})` : ""} (🪙 {PACK_META[lastKind].cost.toLocaleString()})
              </button>
              <Link to="/roster" className="rounded-lg border border-border bg-background px-4 py-2 text-sm">View roster</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
