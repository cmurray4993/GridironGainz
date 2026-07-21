import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { setLineup, useGame } from "@/lib/game/store";
import {
  LINEUP_SLOTS,
  POSITIONS,
  slotAccepts,
  slotPosition,
  type Player,
  type Position,
  type Rarity,
} from "@/lib/game/types";
import { lineupOverall } from "@/lib/game/sim";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/roster")({
  component: TeamPage,
  head: () => ({ meta: [{ title: "Team — Gridiron Gainz" }] }),
});

type Tab = "roster" | "lineup";
const RARITY_RANK: Record<Rarity, number> = { elite: 4, gold: 3, silver: 2, bronze: 1 };

function TeamPage() {
  const [tab, setTab] = useState<Tab>("roster");
  return (
    <div className="animate-float-up space-y-5">
      <header>
        <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Franchise</div>
        <h1 className="mt-1 font-display text-3xl">Team</h1>
        <p className="text-sm text-muted-foreground">
          Manage your roster and set your starting lineup.
        </p>
      </header>

      <div className="inline-flex rounded-full border border-border bg-card/60 p-1 text-xs">
        <TabBtn active={tab === "roster"} onClick={() => setTab("roster")}>
          Roster
        </TabBtn>
        <TabBtn active={tab === "lineup"} onClick={() => setTab("lineup")}>
          Lineup
        </TabBtn>
      </div>

      {tab === "roster" ? <RosterView /> : <LineupView />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 uppercase tracking-widest transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function RosterView() {
  const { roster, lineup } = useGame();
  const inLineup = useMemo(
    () => new Set(Object.values(lineup).filter(Boolean) as string[]),
    [lineup],
  );
  const [filter, setFilter] = useState<Position | "ALL">("ALL");
  const [sort, setSort] = useState<"overall" | "fan" | "rarity">("overall");

  const shown = useMemo(() => {
    return roster
      .filter((p) => filter === "ALL" || p.position === filter)
      .sort((a, b) => {
        if (sort === "overall") return b.overall - a.overall;
        if (sort === "fan") return b.fanValue - a.fanValue;
        return RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity];
      });
  }, [roster, filter, sort]);

  return (
    <div className="space-y-4 pb-8 sm:pb-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {roster.length} player{roster.length === 1 ? "" : "s"} signed.
        </p>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
        >
          <option value="overall">Sort: Overall</option>
          <option value="fan">Sort: Fan value</option>
          <option value="rarity">Sort: Rarity</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={filter === "ALL"} onClick={() => setFilter("ALL")}>
          All
        </Chip>
        {POSITIONS.map((p) => (
          <Chip key={p} active={filter === p} onClick={() => setFilter(p)}>
            {p}
          </Chip>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center">
          <div className="text-5xl">🎴</div>
          <div className="mt-3 font-display text-xl">No players yet</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Open your first pack to start building the franchise.
          </p>
          <Link
            to="/pack"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground"
          >
            Open a pack
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
          {shown.map((p) => {
            const locked = inLineup.has(p.id);
            return (
              <Link
                key={p.id}
                to="/player/$playerId"
                params={{ playerId: p.id }}
                className="relative block"
              >
                <PlayerCard player={p} mobileDense onClick={() => {}} />
                {locked && (
                  <div className="absolute -right-1 -top-1 rounded-full border border-primary/60 bg-background/95 px-1 py-0.5 text-[6px] uppercase tracking-wide text-primary sm:-right-1.5 sm:-top-1.5 sm:px-2 sm:text-[9px] sm:tracking-widest">
                    Starter
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Side = "offense" | "defense" | "special";

// Formation cell references a lineup slot ID (e.g. "WR1"). label overrides
// the position label shown in the slot header.
type Cell = { slot: string; col: number; span?: number; row: number; label?: string };

// Offense: compact fictional shotgun formation.
// Row 1 (LOS):  WR1 | TE  | OL  | WR2
// Row 2 (back): RB  | QB (span 2) | FLEX
const OFFENSE_FORMATION: Cell[] = [
  { slot: "WR1", col: 1, row: 1 },
  { slot: "OL", col: 3, row: 1 },
  { slot: "TE", col: 4, row: 1 },
  { slot: "WR2", col: 5, row: 1 },
  { slot: "QB", col: 3, row: 3 },
  { slot: "RB", col: 2, row: 5 },
  { slot: "FLEX", col: 4, row: 5, label: "FLEX" },
];

// Defense: a compact front, two linebackers, and three defensive backs.
const DEFENSE_FORMATION: Cell[] = [
  { slot: "DFLEX", col: 1, row: 1, label: "FLEX" },
  { slot: "DB3", col: 5, row: 1, label: "DB" },
  { slot: "LB1", col: 2, row: 3 },
  { slot: "LB2", col: 4, row: 3 },
  { slot: "DB1", col: 1, row: 5 },
  { slot: "DL", col: 3, row: 5 },
  { slot: "DB2", col: 5, row: 5 },
];

const SPECIAL_TEAMS_FORMATION: Cell[] = [
  { slot: "K", col: 2, row: 3, label: "KICKER" },
  { slot: "P", col: 4, row: 3, label: "PUNTER" },
];

const FIELD_ROWS = 5;

function LineupView() {
  const { roster, lineup } = useGame();
  const [picking, setPicking] = useState<{
    slot: string;
    label: string;
    accepts: Position[];
  } | null>(null);
  const [side, setSide] = useState<Side>("offense");

  const byId = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const currentPlayers = LINEUP_SLOTS.map((slot) =>
    lineup[slot] ? (byId.get(lineup[slot]!) ?? null) : null,
  );
  const ovr = lineupOverall(currentPlayers);

  const autoFill = () => {
    const used = new Set<string>();
    for (const slot of LINEUP_SLOTS) {
      const accepts = slotAccepts(slot);
      const best = roster
        .filter((p) => accepts.includes(p.position) && !used.has(p.id))
        .sort((a, b) => b.overall - a.overall)[0];
      if (best) {
        setLineup(slot, best.id);
        used.add(best.id);
      } else setLineup(slot, null);
    }
  };

  const clear = () => LINEUP_SLOTS.forEach((s) => setLineup(s, null));

  const baseFormation =
    side === "offense"
      ? OFFENSE_FORMATION
      : side === "defense"
        ? DEFENSE_FORMATION
        : SPECIAL_TEAMS_FORMATION;
  const formation = baseFormation;
  const rows = FIELD_ROWS;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={autoFill}
            disabled={!roster.length}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Auto-fill best
          </button>
          <button
            onClick={clear}
            className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm"
          >
            Clear
          </button>
          <Link
            to="/game"
            className="rounded-lg bg-[image:var(--gradient-gold)] px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
          >
            Kickoff →
          </Link>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/80 px-4 py-2 text-center">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Team OVR
          </div>
          <div className="font-display text-2xl text-gradient-gold leading-none">{ovr || "--"}</div>
        </div>
      </div>

      <div className="inline-flex rounded-full border border-border bg-card/60 p-1 text-xs">
        <TabBtn active={side === "offense"} onClick={() => setSide("offense")}>
          Offense
        </TabBtn>
        <TabBtn active={side === "defense"} onClick={() => setSide("defense")}>
          Defense
        </TabBtn>
        <TabBtn active={side === "special"} onClick={() => setSide("special")}>
          Special Teams
        </TabBtn>
      </div>

      <FormationField rows={rows}>
        {formation.map((cell) => {
          const label = cell.label ?? slotPosition(cell.slot);
          const accepts = slotAccepts(cell.slot);
          const p = lineup[cell.slot] ? byId.get(lineup[cell.slot]!) : null;
          return (
            <div
              key={cell.slot}
              style={{
                gridColumn: cell.col,
                gridRow: cell.row,
              }}
              className="flex items-start justify-center"
            >
              <SlotCard
                label={label}
                player={p ?? null}
                selected={picking?.slot === cell.slot}
                onPick={() => setPicking({ slot: cell.slot, label, accepts })}
                onRemove={() => setLineup(cell.slot, null)}
                onDrop={(id) => {
                  const dropped = byId.get(id);
                  if (dropped && accepts.includes(dropped.position)) setLineup(cell.slot, id);
                }}
              />
            </div>
          );
        })}
      </FormationField>

      {picking && (
        <LineupTray
          slot={picking.slot}
          label={picking.label}
          accepts={picking.accepts}
          roster={roster}
          current={lineup[picking.slot] ? (byId.get(lineup[picking.slot]!) ?? null) : null}
          currentIds={new Set(Object.values(lineup).filter(Boolean) as string[])}
          onPick={(id) => {
            setLineup(picking.slot, id);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

function FormationField({ rows, children }: { rows: number; children: React.ReactNode }) {
  void rows;
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-emerald-900/60 p-2 min-[380px]:p-3 sm:p-5"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 40px), linear-gradient(180deg, #0b3d1f 0%, #0a2f18 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/25" />
      <div
        className="relative grid min-h-[430px] grid-cols-5 grid-rows-[repeat(5,62px)] gap-x-1 sm:min-h-[620px] sm:grid-rows-[repeat(5,90px)]"
        style={{
          rowGap: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SlotCard({
  label,
  player,
  selected,
  onPick,
  onRemove,
  onDrop,
}: {
  label: string;
  player: Player | null;
  selected?: boolean;
  onPick: () => void;
  onRemove: () => void;
  onDrop: (id: string) => void;
}) {
  return (
    <button
      onClick={onPick}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop(e.dataTransfer.getData("text/player-id"));
      }}
      className={cn(
        "group mx-auto w-full max-w-[68px] text-left rounded-md border bg-card/85 p-0.5 backdrop-blur transition-colors min-[380px]:max-w-[74px] sm:max-w-[110px] sm:rounded-lg sm:p-1",
        selected
          ? "border-primary ring-2 ring-primary/40"
          : "border-border/70 hover:border-primary/60",
      )}
    >
      <div className="mb-1 flex items-center justify-between px-0.5">
        <div className="font-display text-[11px] leading-none">{label}</div>
        {player && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="text-[11px] leading-none text-muted-foreground hover:text-destructive"
          >
            ×
          </button>
        )}
      </div>
      {player ? (
        <PlayerCard player={player} compact className="h-[98px] sm:h-[150px]" onClick={onPick} />
      ) : (
        <div className="grid h-[98px] w-full place-items-center rounded-md border border-dashed border-border/60 px-1 text-center text-[8px] text-muted-foreground sm:h-[150px] sm:text-[10px]">
          + {label}
        </div>
      )}
    </button>
  );
}

function LineupTray({
  slot,
  label,
  accepts,
  roster,
  current,
  currentIds,
  onPick,
  onClose,
}: {
  slot: string;
  label: string;
  accepts: Position[];
  roster: Player[];
  current: Player | null;
  currentIds: Set<string>;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [comparing, setComparing] = useState<Player | null>(null);
  const options = roster
    .filter((p) => accepts.includes(p.position) && p.id !== current?.id)
    .sort((a, b) => b.overall - a.overall);
  const subtitle = accepts.length > 1 ? accepts.join(" / ") : "";
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[radial-gradient(circle_at_50%_30%,oklch(0.22_0.025_240),oklch(0.09_0.015_245)_62%)]"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="min-h-full animate-float-up">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/55 px-4 py-3 backdrop-blur-xl sm:px-7">
          <button
            onClick={onClose}
            className="flex items-center gap-2 font-display text-xl sm:text-3xl"
          >
            <span className="text-3xl text-primary">‹</span> {label} POSITION
          </button>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Eligible
            </div>
            <div className="font-display text-xl">{subtitle || label}</div>
          </div>
        </header>

        <main className="mx-auto grid max-w-6xl grid-cols-2 items-start gap-3 px-3 py-4 sm:px-5 lg:grid-cols-[250px_minmax(300px,1fr)_250px] lg:items-center lg:gap-6 lg:py-10">
          <section className="order-1 min-w-0">
            <div className="mb-2 text-center text-[10px] uppercase tracking-[0.25em] text-primary">
              Current starter
            </div>
            {current ? (
              <div className="mx-auto w-full max-w-[150px] lg:max-w-[240px]">
                <PlayerCard player={current} mobileDense onClick={() => {}} />
              </div>
            ) : (
              <div className="mx-auto grid h-[148px] w-full max-w-[150px] place-items-center rounded-xl border border-dashed border-white/20 p-2 text-center text-xs text-muted-foreground lg:h-[330px] lg:max-w-[220px] lg:text-sm">
                Empty {label} slot
              </div>
            )}
          </section>

          <section className="order-3 col-span-2 lg:order-2 lg:col-span-1">
            <div className="mb-4 text-center font-display text-4xl text-gradient-gold">
              {current?.overall ?? "--"} <span className="text-xl text-foreground">OVR</span>
            </div>
            <div className="space-y-1.5">
              <PositionAttribute
                icon="◆"
                label="Strength"
                value={current?.strength}
                compareValue={comparing?.strength}
              />
              <PositionAttribute
                icon="➤"
                label="Speed"
                value={current?.speed}
                compareValue={comparing?.speed}
              />
              <PositionAttribute
                icon="●"
                label="IQ"
                value={current?.iq}
                compareValue={comparing?.iq}
              />
              <PositionAttribute
                icon="★"
                label="Popularity"
                value={current?.popularity}
                compareValue={comparing?.popularity}
              />
              <PositionAttribute
                icon="♥"
                label="Fan Value"
                value={current?.fanValue}
                compareValue={comparing?.fanValue}
              />
              {current?.signature && (
                <PositionAttribute
                  icon="✦"
                  label={current.signature.label}
                  value={current.signature.value}
                  compareValue={comparing?.signature?.value}
                />
              )}
            </div>
          </section>

          <section
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/player-id");
              const player = roster.find((p) => p.id === id);
              if (player) setComparing(player);
            }}
            className="order-2 grid min-h-[190px] min-w-0 place-items-center rounded-xl border-2 border-dashed border-white/20 bg-black/20 p-2 text-center transition-colors hover:border-primary/60 lg:order-3 lg:min-h-[300px] lg:p-5"
          >
            {comparing ? (
              <div className="w-full">
                <div className="mx-auto w-full max-w-[130px] lg:max-w-[150px]">
                  <PlayerCard
                    player={comparing}
                    compact
                    className="h-[132px] lg:h-[150px]"
                    onClick={() => {}}
                  />
                </div>
                <div className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">
                  Comparison player
                </div>
                <div className="mt-3 grid gap-2">
                  <button
                    onClick={() => onPick(comparing.id)}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    Confirm replacement
                  </button>
                  <button
                    onClick={() => setComparing(null)}
                    className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
                  >
                    Cancel comparison
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-3xl text-primary/70 lg:text-4xl">⇧</div>
                <div className="mt-2 font-display text-base lg:text-xl">SELECT A PLAYER</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground lg:text-xs lg:tracking-widest">
                  to compare before replacing
                </div>
              </div>
            )}
          </section>
        </main>

        <section className="border-t border-white/10 bg-[oklch(0.075_0.025_245)] px-4 py-5 sm:px-7">
          <div className="mx-auto max-w-6xl">
            <div className="mb-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Replacement players on your bench
            </div>
            {options.length === 0 ? (
              <div className="py-10 text-center font-display text-xl text-muted-foreground">
                You have no replacement players for this position
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pb-2 sm:flex sm:gap-3 sm:overflow-x-auto">
                {options.map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/player-id", p.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="min-w-0 cursor-grab active:cursor-grabbing sm:w-[260px] sm:shrink-0"
                  >
                    <PlayerComparison
                      player={p}
                      baseline={current}
                      inLineup={currentIds.has(p.id)}
                      onReplace={() => setComparing(p)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function PositionAttribute({
  icon,
  label,
  value,
  compareValue,
}: {
  icon: string;
  label: string;
  value?: number;
  compareValue?: number;
}) {
  const delta = value != null && compareValue != null ? compareValue - value : null;
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2 py-2 sm:gap-3 sm:px-4 sm:py-3">
      <span className="w-4 text-center text-xs text-primary sm:w-5 sm:text-base">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold sm:text-base">{label}</span>
      <span className="font-display text-base sm:text-xl">{value ?? "--"}</span>
      {compareValue != null ? (
        <span
          className={cn(
            "min-w-12 text-right font-display text-base sm:min-w-16 sm:text-xl",
            delta && delta > 0
              ? "text-emerald-400"
              : delta && delta < 0
                ? "text-red-400"
                : "text-muted-foreground",
          )}
        >
          → {compareValue}
          {delta ? (
            <small className="ml-1 text-[10px]">
              ({delta > 0 ? "+" : ""}
              {delta})
            </small>
          ) : null}
        </span>
      ) : (
        <span className="text-xl text-primary">+</span>
      )}
    </div>
  );
}

function PlayerComparison({
  player,
  baseline,
  current,
  inLineup,
  onReplace,
}: {
  player: Player;
  baseline: Player | null;
  current?: boolean;
  inLineup?: boolean;
  onReplace?: () => void;
}) {
  const delta = (value: number, base?: number) => (base == null ? null : value - base);
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        current ? "border-primary/50 bg-primary/5" : "border-border bg-card/70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-lg leading-tight truncate">{player.name}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {player.position} · {player.rarity}
            {inLineup ? " · In lineup" : ""}
          </div>
        </div>
        <div className="font-display text-3xl text-gradient-gold">{player.overall}</div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <CompareStat
          label="STR"
          value={player.strength}
          delta={delta(player.strength, baseline?.strength)}
        />
        <CompareStat
          label="SPD"
          value={player.speed}
          delta={delta(player.speed, baseline?.speed)}
        />
        <CompareStat label="IQ" value={player.iq} delta={delta(player.iq, baseline?.iq)} />
        <CompareStat
          label="POP"
          value={player.popularity}
          delta={delta(player.popularity, baseline?.popularity)}
        />
      </div>
      {onReplace && (
        <button
          onClick={onReplace}
          className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          Compare player
        </button>
      )}
    </div>
  );
}

function CompareStat({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta: number | null;
}) {
  return (
    <div className="rounded-md bg-background/70 p-1.5 text-center">
      <div className="text-[9px] tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-lg leading-none">{value}</div>
      {delta !== null && delta !== 0 && (
        <div className={cn("text-[9px]", delta > 0 ? "text-emerald-400" : "text-red-400")}>
          {delta > 0 ? "+" : ""}
          {delta}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
