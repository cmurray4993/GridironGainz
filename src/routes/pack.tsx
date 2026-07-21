import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PlayerCard } from "@/components/PlayerCard";
import { refreshAuthoritativeState, useGame } from "@/lib/game/store";
import {
  fetchPackDefinitions,
  openAuthoritativePack,
  type PackDefinition,
} from "@/lib/game/authoritative";
import {
  BACKYARD_HERO_PACK_COST,
  PACK_COST,
  PACK_SIZE,
  POSITION_PACK_COST,
  POSITIONS,
  PRO_PACK_COST,
  type Player,
  type Position,
} from "@/lib/game/types";

export const Route = createFileRoute("/pack")({
  component: PackPage,
  head: () => ({
    meta: [
      { title: "Pack Store — Gridiron Gainz" },
      { name: "description", content: "Open packs and reveal player cards." },
    ],
  }),
});

type Phase = "idle" | "opening" | "revealed";
type PackKind = "standard" | "position" | "pro" | "backyard";
type Currency = "coins" | "cash";

const PACK_META: Record<
  PackKind,
  {
    name: string;
    cost: number;
    cashCost: number;
    blurb: string;
    gradient: string;
    emoji: string;
    tag?: string;
  }
> = {
  standard: {
    name: "Standard Pack",
    cost: PACK_COST,
    cashCost: 100,
    blurb: "5 players. Elite pulls are rare.",
    gradient: "var(--gradient-card-elite)",
    emoji: "🎴",
  },
  position: {
    name: "Position Pack",
    cost: POSITION_PACK_COST,
    cashCost: 300,
    blurb: "Pick a position. 1 player. 5% Gold, 1% Elite.",
    gradient: "var(--gradient-card-elite)",
    emoji: "🎯",
    tag: "Targeted",
  },
  pro: {
    name: "Pro Pack",
    cost: PRO_PACK_COST,
    cashCost: 500,
    blurb: "3 Bronze+, 1 Silver+, 1 Gold+ guaranteed.",
    gradient: "var(--gradient-card-elite)",
    emoji: "💎",
  },
  backyard: {
    name: "Backyard Heroes",
    cost: BACKYARD_HERO_PACK_COST,
    cashCost: 1000,
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
  const [lastCurrency, setLastCurrency] = useState<Currency>("coins");
  const [pendingCurrency, setPendingCurrency] = useState<Currency>("coins");
  const [lastPosition, setLastPosition] = useState<Position>("QB");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oddsOpen, setOddsOpen] = useState(false);
  const [publishedOdds, setPublishedOdds] = useState<PackDefinition[]>([]);
  const retryRequests = useRef(new Map<string, string>());

  useEffect(() => {
    fetchPackDefinitions()
      .then(setPublishedOdds)
      .catch(() => {});
  }, []);

  const openPack = async (kind: PackKind, currency: Currency, position?: Position) => {
    const meta = PACK_META[kind];
    const cost = currency === "cash" ? meta.cashCost : meta.cost;
    if (currency === "cash" ? (state.gridironCash ?? 0) < cost : state.coins < cost) return;
    if (kind === "position" && !position) {
      setPendingCurrency(currency);
      setPickerOpen(true);
      return;
    }
    if (busy) return;
    const retryKey = `${kind}:${currency}:${position ?? "all"}`;
    const requestId = retryRequests.current.get(retryKey) ?? crypto.randomUUID();
    retryRequests.current.set(retryKey, requestId);
    setBusy(true);
    let players: Player[];
    try {
      const opening = await openAuthoritativePack(
        kind,
        currency === "cash" ? "gc" : "coins",
        requestId,
        position,
      );
      players = opening.cards;
      retryRequests.current.delete(retryKey);
      await refreshAuthoritativeState();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pack opening failed");
      setBusy(false);
      return;
    }
    setPull(players);
    setRevealed(0);
    setLastKind(kind);
    setLastCurrency(currency);
    if (position) setLastPosition(position);
    setPickerOpen(false);
    setPhase("opening");
    players.forEach((_, i) => {
      setTimeout(() => setRevealed((r) => Math.max(r, i + 1)), 400 + i * 500);
    });
    setTimeout(
      () => {
        setPhase("revealed");
        setBusy(false);
      },
      400 + players.length * 500 + 300,
    );
  };

  const reset = () => {
    setPull([]);
    setPhase("idle");
    setRevealed(0);
  };

  return (
    <div className="animate-float-up space-y-6">
      <header className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Store</div>
          <h1 className="mt-1 font-display text-3xl">Pack Store</h1>
          <p className="text-sm text-muted-foreground">
            Every purchase and card roll is finalized securely on the game server.
          </p>
        </div>
        <button
          onClick={() => setOddsOpen(true)}
          className="self-start rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary sm:self-auto"
        >
          View pack odds
        </button>
      </header>

      {phase === "idle" && (
        <div className="grid grid-cols-2 gap-2.5 min-[420px]:gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {(["standard", "position", "pro", "backyard"] as PackKind[]).map((kind) => {
            const meta = PACK_META[kind];
            const canAffordCoins = state.coins >= meta.cost;
            const canAffordCash = (state.gridironCash ?? 0) >= meta.cashCost;
            const canAfford = canAffordCoins || canAffordCash;
            const isPromo = kind === "backyard";
            return (
              <div key={kind} className="group relative text-left">
                <div
                  className={`relative h-52 w-full overflow-hidden rounded-xl border min-[420px]:h-60 sm:h-72 sm:rounded-2xl ${isPromo ? "border-primary" : kind === "pro" ? "border-primary/60" : "border-primary/40"} bg-[image:var(--gradient-card-elite)] shadow-[var(--shadow-card)] transition-transform ${canAfford ? "group-hover:-translate-y-1 animate-pulse-glow" : "opacity-60"}`}
                >
                  <div className="absolute inset-0 shimmer-overlay opacity-60" />
                  {isPromo && (
                    <div className="absolute left-2 top-2 z-10 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary-foreground">
                      Limited
                    </div>
                  )}
                  <div className="absolute inset-1.5 flex flex-col items-center justify-center rounded-lg bg-background/70 p-2 text-center sm:inset-2 sm:rounded-xl sm:p-4">
                    <div className="text-[10px] uppercase tracking-[0.4em] text-primary/80">
                      {meta.tag ?? (kind === "pro" ? "Premium" : "Gridiron Gainz")}
                    </div>
                    <div className="mt-1 font-display text-xl text-gradient-gold min-[420px]:text-2xl sm:mt-2 sm:text-3xl">
                      {meta.name}
                    </div>
                    <div className="mt-2 text-3xl sm:mt-3 sm:text-5xl">{meta.emoji}</div>
                    <div className="mt-2 line-clamp-3 px-1 text-[10px] text-muted-foreground sm:mt-3 sm:px-3 sm:text-xs">
                      {meta.blurb}
                    </div>
                  </div>
                </div>
                <div className="mt-2 grid gap-1.5 sm:mt-3 sm:grid-cols-2 sm:gap-2">
                  <button
                    onClick={() => openPack(kind, "coins")}
                    disabled={!canAffordCoins || busy}
                    className="rounded-full bg-primary px-2 py-2 text-center text-[11px] font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none sm:px-3 sm:text-sm"
                  >
                    {canAffordCoins
                      ? `🪙 ${meta.cost.toLocaleString()}`
                      : `Need 🪙 ${meta.cost.toLocaleString()}`}
                  </button>
                  <button
                    onClick={() => openPack(kind, "cash")}
                    disabled={!canAffordCash || busy}
                    className="rounded-full bg-fuchsia-600 px-2 py-2 text-center text-[11px] font-semibold text-white shadow-[var(--shadow-glow)] disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none sm:px-3 sm:text-sm"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      <img src="/gc-icon.png" alt="GC" className="h-5 w-5 object-contain" />
                      {canAffordCash
                        ? meta.cashCost.toLocaleString()
                        : `Need ${meta.cashCost.toLocaleString()}`}
                    </span>
                  </button>
                </div>
              </div>
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
                    <div
                      className={isRare ? "animate-rare-reveal relative" : "animate-card-reveal"}
                    >
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
              <button
                onClick={reset}
                className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm hover:bg-secondary/70"
              >
                Back to store
              </button>
              <button
                onClick={() =>
                  openPack(
                    lastKind,
                    lastCurrency,
                    lastKind === "position" ? lastPosition : undefined,
                  )
                }
                disabled={
                  lastCurrency === "cash"
                    ? (state.gridironCash ?? 0) < PACK_META[lastKind].cashCost
                    : state.coins < PACK_META[lastKind].cost
                }
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Open another {PACK_META[lastKind].name}
                {lastKind === "position" ? ` (${lastPosition})` : ""} (
                {lastCurrency === "cash" ? "GC" : "🪙"}{" "}
                {(lastCurrency === "cash"
                  ? PACK_META[lastKind].cashCost
                  : PACK_META[lastKind].cost
                ).toLocaleString()}
                )
              </button>
              <Link
                to="/roster"
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm"
              >
                View roster
              </Link>
            </div>
          )}
        </div>
      )}

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-primary/40 bg-background p-5 shadow-[var(--shadow-glow)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80">
              Position Pack
            </div>
            <h2 className="mt-1 font-display text-2xl">Pick a position</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              One player at your chosen position. 5% Gold · 1% Elite.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => openPack("position", pendingCurrency, pos)}
                  className="rounded-lg border border-border bg-secondary py-3 font-display text-lg hover:border-primary hover:bg-primary/10"
                >
                  {pos}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-xs text-muted-foreground">
              <span>
                Cost:{" "}
                {pendingCurrency === "cash"
                  ? `GC ${PACK_META.position.cashCost}`
                  : `🪙 ${POSITION_PACK_COST.toLocaleString()}`}
              </span>
              <button
                onClick={() => setPickerOpen(false)}
                className="underline hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {oddsOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"
          onClick={() => setOddsOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-primary/40 bg-background p-5 shadow-[var(--shadow-glow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[.3em] text-primary">
                  Published odds
                </div>
                <h2 className="font-display text-3xl">Pack probabilities</h2>
              </div>
              <button
                onClick={() => setOddsOpen(false)}
                className="rounded-lg border border-border px-3 py-1 text-sm"
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The exact version and odds below are copied into every permanent pack-opening record.
              Each card is generated independently unless a slot guarantee is shown.
            </p>
            <div className="mt-4 space-y-3">
              {publishedOdds
                .filter((pack) => pack.code !== "starter")
                .map((pack) => (
                  <section
                    key={pack.code}
                    className="rounded-xl border border-border/70 bg-card/70 p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <h3 className="font-display text-xl">{pack.display_name}</h3>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Version {pack.version} · {pack.card_count} card
                        {pack.card_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{pack.odds.description}</p>
                    <div className="mt-3 space-y-2">
                      {(pack.odds.slots ?? []).map((slot, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-2 gap-1.5 rounded-lg bg-background/50 p-2 text-center text-[10px] sm:grid-cols-5 sm:gap-2 sm:text-xs"
                        >
                          <div className="col-span-2 text-left text-muted-foreground sm:col-span-1">
                            {slot.count}× slot
                          </div>
                          <div>Bronze {Math.round((slot.bronze ?? 0) * 100)}%</div>
                          <div>Silver {Math.round((slot.silver ?? 0) * 100)}%</div>
                          <div>Gold {Math.round((slot.gold ?? 0) * 100)}%</div>
                          <div>Elite {Math.round((slot.elite ?? 0) * 100)}%</div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
