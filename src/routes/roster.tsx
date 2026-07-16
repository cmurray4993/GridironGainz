import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { discardPlayer, sellPlayer, sellPrice, useGame } from "@/lib/game/store";
import { POSITIONS, type Player, type Position, type Rarity } from "@/lib/game/types";

export const Route = createFileRoute("/roster")({
  component: RosterPage,
  head: () => ({ meta: [{ title: "Roster — Fourth & Fortune" }] }),
});

function RosterPage() {
  const { roster, lineup } = useGame();
  const [confirming, setConfirming] = useState<Player | null>(null);
  const inLineup = useMemo(
    () => new Set(Object.values(lineup).filter(Boolean) as string[]),
    [lineup],
  );
  const [filter, setFilter] = useState<Position | "ALL">("ALL");
  const [sort, setSort] = useState<"overall" | "fan" | "rarity">("overall");

  const rarityRank: Record<Rarity, number> = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
  const shown = useMemo(() => {
    return roster
      .filter((p) => filter === "ALL" || p.position === filter)
      .sort((a, b) => {
        if (sort === "overall") return b.overall - a.overall;
        if (sort === "fan") return b.fanValue - a.fanValue;
        return rarityRank[b.rarity] - rarityRank[a.rarity];
      });
  }, [roster, filter, sort]);

  return (
    <div className="animate-float-up space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Franchise</div>
          <h1 className="mt-1 font-display text-3xl">Roster</h1>
          <p className="text-sm text-muted-foreground">{roster.length} player{roster.length === 1 ? "" : "s"} signed.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-md border border-border bg-card px-2 py-1.5">
            <option value="overall">Sort: Overall</option>
            <option value="fan">Sort: Fan value</option>
            <option value="rarity">Sort: Rarity</option>
          </select>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={filter === "ALL"} onClick={() => setFilter("ALL")}>All</Chip>
        {POSITIONS.map((p) => (
          <Chip key={p} active={filter === p} onClick={() => setFilter(p)}>{p}</Chip>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center">
          <div className="text-5xl">🎴</div>
          <div className="mt-3 font-display text-xl">No players yet</div>
          <p className="mt-1 text-sm text-muted-foreground">Open your first pack to start building the franchise.</p>
          <Link to="/pack" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Open a pack</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {shown.map((p) => {
            const locked = inLineup.has(p.id);
            return (
              <div key={p.id} className="relative">
                <PlayerCard player={p} />
                {!locked && (
                  <button
                    onClick={() => setConfirming(p)}
                    aria-label={`Remove ${p.name}`}
                    title="Remove or sell this card"
                    className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full border border-border bg-background/95 text-sm text-muted-foreground shadow-md hover:border-destructive hover:text-destructive"
                  >
                    ×
                  </button>
                )}
                {locked && (
                  <div className="absolute -right-1.5 -top-1.5 rounded-full border border-primary/60 bg-background/95 px-2 py-0.5 text-[9px] uppercase tracking-widest text-primary">
                    Starter
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {confirming && (
        <RemoveModal
          player={confirming}
          onClose={() => setConfirming(null)}
          onSell={() => { sellPlayer(confirming.id); setConfirming(null); }}
          onDiscard={() => { discardPlayer(confirming.id); setConfirming(null); }}
        />
      )}
    </div>
  );
}

function RemoveModal({
  player, onClose, onSell, onDiscard,
}: { player: Player; onClose: () => void; onSell: () => void; onDiscard: () => void }) {
  const price = sellPrice(player);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-card)] animate-float-up space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Remove card</div>
          <div className="font-display text-2xl leading-tight">{player.name}</div>
          <div className="text-xs text-muted-foreground">{player.position} · OVR {player.overall} · −{player.fanValue} fans</div>
        </div>
        <p className="text-sm text-muted-foreground">
          Sell this card for coins, or discard it to free up roster space without a payout. Either way you lose the fan value it generates.
        </p>
        <div className="grid gap-2">
          <button
            onClick={onSell}
            className="w-full rounded-lg bg-[image:var(--gradient-gold)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
          >
            Sell for 🪙 {price}
          </button>
          <button
            onClick={onDiscard}
            className="w-full rounded-lg border border-destructive/60 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive"
          >
            Discard (no refund)
          </button>
          <button onClick={onClose} className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
