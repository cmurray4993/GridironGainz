import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { discardPlayer, sellPlayer, sellPrice, setLineup, useGame } from "@/lib/game/store";
import { LINEUP_SLOTS, POSITIONS, slotPosition, type Player, type Position, type Rarity } from "@/lib/game/types";
import { lineupOverall } from "@/lib/game/sim";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/roster")({
  component: TeamPage,
  head: () => ({ meta: [{ title: "Team — Fourth & Fortune" }] }),
});

type Tab = "roster" | "lineup";

function TeamPage() {
  const [tab, setTab] = useState<Tab>("roster");
  return (
    <div className="animate-float-up space-y-5">
      <header>
        <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Franchise</div>
        <h1 className="mt-1 font-display text-3xl">Team</h1>
        <p className="text-sm text-muted-foreground">Manage your roster and set your starting lineup.</p>
      </header>

      <div className="inline-flex rounded-full border border-border bg-card/60 p-1 text-xs">
        <TabBtn active={tab === "roster"} onClick={() => setTab("roster")}>Roster</TabBtn>
        <TabBtn active={tab === "lineup"} onClick={() => setTab("lineup")}>Lineup</TabBtn>
      </div>

      {tab === "roster" ? <RosterView /> : <LineupView />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 uppercase tracking-widest transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function RosterView() {
  const { roster, lineup } = useGame();
  const [confirming, setConfirming] = useState<Player | null>(null);
  const inLineup = useMemo(
    () => new Set(Object.values(lineup).filter(Boolean) as string[]),
    [lineup],
  );
  const [filter, setFilter] = useState<Position | "ALL">("ALL");
  const [sort, setSort] = useState<"overall" | "fan" | "rarity">("overall");

  const rarityRank: Record<Rarity, number> = { elite: 4, gold: 3, silver: 2, bronze: 1 };
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">{roster.length} player{roster.length === 1 ? "" : "s"} signed.</p>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-md border border-border bg-card px-2 py-1.5 text-xs">
          <option value="overall">Sort: Overall</option>
          <option value="fan">Sort: Fan value</option>
          <option value="rarity">Sort: Rarity</option>
        </select>
      </div>

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

type Side = "offense" | "defense";

// Formation cell: grid col-start / col-span / row (1-indexed) inside a 6-col grid
type Cell = { pos: Position; col: number; span?: number; row: number; label?: string };

// Offense: shotgun spread
// Row 1 (line): WR left | OL center-left | TE center-right | K far right
// Row 2 (backfield): RB left | QB center
const OFFENSE_FORMATION: Cell[] = [
  { pos: "WR", col: 1, row: 1 },
  { pos: "OL", col: 3, row: 1 },
  { pos: "TE", col: 4, row: 1 },
  { pos: "K",  col: 6, row: 1 },
  { pos: "RB", col: 2, row: 2 },
  { pos: "QB", col: 3, span: 2, row: 2 },
];

// Defense: 3-level look
// Row 1: DL front (spans middle)
// Row 2: LB (spans middle)
// Row 3: DB (deep, spans middle)
const DEFENSE_FORMATION: Cell[] = [
  { pos: "DL", col: 3, span: 2, row: 1 },
  { pos: "LB", col: 3, span: 2, row: 2 },
  { pos: "DB", col: 3, span: 2, row: 3 },
];

function LineupView() {
  const { roster, lineup } = useGame();
  const [picking, setPicking] = useState<Position | null>(null);
  const [side, setSide] = useState<Side>("offense");

  const byId = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const currentPlayers = LINEUP_SLOTS.map((pos) => (lineup[pos] ? byId.get(lineup[pos]!) ?? null : null));
  const ovr = lineupOverall(currentPlayers);

  const autoFill = () => {
    const used = new Set<string>();
    for (const pos of LINEUP_SLOTS) {
      const best = roster
        .filter((p) => p.position === pos && !used.has(p.id))
        .sort((a, b) => b.overall - a.overall)[0];
      if (best) { setLineup(pos, best.id); used.add(best.id); }
      else setLineup(pos, null);
    }
  };

  const clear = () => LINEUP_SLOTS.forEach((p) => setLineup(p, null));

  const formation = side === "offense" ? OFFENSE_FORMATION : DEFENSE_FORMATION;
  const rows = Math.max(...formation.map((c) => c.row));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-2">
          <button onClick={autoFill} disabled={!roster.length} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Auto-fill best</button>
          <button onClick={clear} className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm">Clear</button>
          <Link to="/game" className="rounded-lg bg-[image:var(--gradient-gold)] px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">Kickoff →</Link>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/80 px-4 py-2 text-center">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Team OVR</div>
          <div className="font-display text-2xl text-gradient-gold leading-none">{ovr || "--"}</div>
        </div>
      </div>

      <div className="inline-flex rounded-full border border-border bg-card/60 p-1 text-xs">
        <TabBtn active={side === "offense"} onClick={() => setSide("offense")}>Offense</TabBtn>
        <TabBtn active={side === "defense"} onClick={() => setSide("defense")}>Defense</TabBtn>
      </div>

      <FormationField rows={rows}>
        {formation.map((cell) => {
          const p = lineup[cell.pos] ? byId.get(lineup[cell.pos]!) : null;
          return (
            <div
              key={cell.pos}
              style={{
                gridColumn: `${cell.col} / span ${cell.span ?? 1}`,
                gridRow: cell.row,
              }}
              className="flex justify-center"
            >
              <SlotCard
                pos={cell.pos}
                player={p ?? null}
                onPick={() => setPicking(cell.pos)}
                onRemove={() => setLineup(cell.pos, null)}
              />
            </div>
          );
        })}
      </FormationField>

      {picking && (
        <PickerModal
          position={picking}
          roster={roster}
          currentIds={new Set(Object.values(lineup).filter(Boolean) as string[])}
          onPick={(id) => { setLineup(picking, id); setPicking(null); }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

function FormationField({ rows, children }: { rows: number; children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-emerald-900/60 p-3 sm:p-5"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 40px), linear-gradient(180deg, #0b3d1f 0%, #0a2f18 100%)",
      }}
    >
      {/* yard lines accents */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/30" />
      <div
        className="relative grid gap-2 sm:gap-3"
        style={{
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SlotCard({
  pos, player, onPick, onRemove,
}: { pos: Position; player: Player | null; onPick: () => void; onRemove: () => void }) {
  return (
    <button
      onClick={onPick}
      className="group w-full max-w-[160px] text-left rounded-xl border border-border/70 bg-card/85 p-2 backdrop-blur hover:border-primary/60 transition-colors"
    >
      <div className="mb-1.5 flex items-center justify-between px-1">
        <div className="font-display text-sm">{pos}</div>
        {player && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-[9px] uppercase text-muted-foreground hover:text-destructive"
          >
            ×
          </button>
        )}
      </div>
      {player ? (
        <PlayerCard player={player} />
      ) : (
        <div className="grid h-[150px] place-items-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
          + {pos}
        </div>
      )}
    </button>
  );
}

function PickerModal({
  position, roster, currentIds, onPick, onClose,
}: {
  position: Position; roster: Player[]; currentIds: Set<string>;
  onPick: (id: string) => void; onClose: () => void;
}) {
  const options = roster.filter((p) => p.position === position).sort((a, b) => b.overall - a.overall);
  return (
    <div className="fixed inset-0 z-40 grid place-items-end sm:place-items-center bg-black/70 backdrop-blur-sm p-3" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--shadow-card)] flex flex-col animate-float-up">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Assign position</div>
            <div className="font-display text-2xl">{position}</div>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground">Close</button>
        </header>
        <div className="p-4 overflow-y-auto">
          {options.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No {position} on your roster. Open packs to find one.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {options.map((p) => (
                <PlayerCard key={p.id} player={p} onClick={() => onPick(p.id)} selected={currentIds.has(p.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
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
