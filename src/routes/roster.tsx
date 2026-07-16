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
  const { roster } = useGame();
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
          {shown.map((p) => <PlayerCard key={p.id} player={p} />)}
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
