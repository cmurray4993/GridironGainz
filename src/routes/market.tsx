import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { sellPlayer, sellPrice, useGame } from "@/lib/game/store";
import { POSITIONS, type Player, type Position, type Rarity } from "@/lib/game/types";

export const Route = createFileRoute("/market")({
  component: MarketPage,
  head: () => ({ meta: [{ title: "Marketplace — Fourth & Fortune" }] }),
});

const rarityRank: Record<Rarity, number> = { elite: 4, gold: 3, silver: 2, bronze: 1 };

function MarketPage() {
  const { roster, lineup } = useGame();
  const [filter, setFilter] = useState<Position | "ALL">("ALL");
  const [sort, setSort] = useState<"price" | "overall" | "rarity">("price");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);

  const inLineup = useMemo(
    () => new Set(Object.values(lineup).filter(Boolean) as string[]),
    [lineup],
  );

  const shown = useMemo(() => {
    return roster
      .filter((p) => filter === "ALL" || p.position === filter)
      .sort((a, b) => {
        if (sort === "overall") return b.overall - a.overall;
        if (sort === "rarity") return rarityRank[b.rarity] - rarityRank[a.rarity];
        return sellPrice(b) - sellPrice(a);
      });
  }, [roster, filter, sort]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalOffered = useMemo(() => {
    return shown
      .filter((p) => selected.has(p.id))
      .reduce((sum, p) => sum + sellPrice(p), 0);
  }, [selected, shown]);

  const sellSelected = () => {
    let earned = 0;
    let sold = 0;
    for (const id of Array.from(selected)) {
      if (inLineup.has(id)) continue;
      const got = sellPlayer(id);
      if (got > 0) {
        earned += got;
        sold += 1;
      }
    }
    setSelected(new Set());
    if (sold > 0) {
      setFlash(`Sold ${sold} card${sold === 1 ? "" : "s"} for 🪙 ${earned}`);
      setTimeout(() => setFlash(null), 2500);
    }
  };

  const sellOne = (p: Player) => {
    if (inLineup.has(p.id)) return;
    const got = sellPlayer(p.id);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(p.id);
      return next;
    });
    setFlash(`Sold ${p.name} for 🪙 ${got}`);
    setTimeout(() => setFlash(null), 2000);
  };

  return (
    <div className="animate-float-up space-y-5 pb-24">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Franchise</div>
          <h1 className="mt-1 font-display text-3xl">Marketplace</h1>
          <p className="text-sm text-muted-foreground">
            Offload cards you no longer need. Prices scale with rarity and overall.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-md border border-border bg-card px-2 py-1.5"
          >
            <option value="price">Sort: Sale price</option>
            <option value="overall">Sort: Overall</option>
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
          <div className="text-5xl">🛒</div>
          <div className="mt-3 font-display text-xl">Nothing to sell</div>
          <p className="mt-1 text-sm text-muted-foreground">Sign some players first, then come back to trade.</p>
          <Link to="/pack" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Open a pack</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {shown.map((p) => {
            const price = sellPrice(p);
            const locked = inLineup.has(p.id);
            const isSel = selected.has(p.id);
            return (
              <div key={p.id} className="relative">
                <PlayerCard
                  player={p}
                  onClick={locked ? undefined : () => toggle(p.id)}
                  selected={isSel}
                />
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-card/70 px-2 py-1.5">
                  <div className="text-xs">
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Offer</div>
                    <div className="font-semibold text-[oklch(0.85_0.17_88)]">🪙 {price}</div>
                  </div>
                  {locked ? (
                    <span className="text-[10px] uppercase text-muted-foreground">In lineup</span>
                  ) : (
                    <button
                      onClick={() => sellOne(p)}
                      className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
                    >
                      Sell
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-5xl px-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/50 bg-background/95 px-4 py-3 shadow-[var(--shadow-glow)] backdrop-blur-md">
            <div className="text-sm">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Selected</div>
              <div className="font-semibold">
                {selected.size} card{selected.size === 1 ? "" : "s"} · 🪙 {totalOffered}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelected(new Set())}
                className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm"
              >
                Clear
              </button>
              <button
                onClick={sellSelected}
                className="rounded-lg bg-[image:var(--gradient-gold)] px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
              >
                Sell all
              </button>
            </div>
          </div>
        </div>
      )}

      {flash && (
        <div className="fixed inset-x-0 top-20 z-40 mx-auto max-w-sm px-3">
          <div className="rounded-xl border border-primary/60 bg-background/95 px-4 py-2 text-center text-sm shadow-[var(--shadow-glow)]">
            {flash}
          </div>
        </div>
      )}
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
