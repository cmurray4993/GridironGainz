import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { setLineup, useGame } from "@/lib/game/store";
import { LINEUP_SLOTS, type Player, type Position } from "@/lib/game/types";
import { lineupOverall } from "@/lib/game/sim";

export const Route = createFileRoute("/lineup")({
  component: LineupPage,
  head: () => ({ meta: [{ title: "Lineup — Fourth & Fortune" }] }),
});

function LineupPage() {
  const { roster, lineup } = useGame();
  const [picking, setPicking] = useState<Position | null>(null);

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

  return (
    <div className="animate-float-up space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Playbook</div>
          <h1 className="mt-1 font-display text-3xl">Set Your Lineup</h1>
          <p className="text-sm text-muted-foreground">Field one player per position.</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/80 px-4 py-2 text-center">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Team OVR</div>
          <div className="font-display text-3xl text-gradient-gold leading-none">{ovr || "--"}</div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <button onClick={autoFill} disabled={!roster.length} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Auto-fill best</button>
        <button onClick={clear} className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm">Clear</button>
        <Link to="/game" className="ml-auto rounded-lg bg-[image:var(--gradient-gold)] px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">Kickoff →</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {LINEUP_SLOTS.map((pos) => {
          const p = lineup[pos] ? byId.get(lineup[pos]!) : null;
          return (
            <button
              key={pos}
              onClick={() => setPicking(pos)}
              className="group text-left rounded-xl border border-border/70 bg-card/70 p-2 hover:border-primary/60 transition-colors min-h-[220px]"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="font-display text-lg">{pos}</div>
                {p && <button onClick={(e) => { e.stopPropagation(); setLineup(pos, null); }} className="text-[10px] uppercase text-muted-foreground hover:text-destructive">Remove</button>}
              </div>
              {p ? (
                <PlayerCard player={p} />
              ) : (
                <div className="grid h-[180px] place-items-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
                  + Assign {pos}
                </div>
              )}
            </button>
          );
        })}
      </div>

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
