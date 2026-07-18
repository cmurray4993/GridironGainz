import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { resetAll, setTeamName, useGame } from "@/lib/game/store";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Gridiron Gainz" }] }),
});

function SettingsPage() {
  const { teamName } = useGame();
  const [name, setName] = useState(teamName ?? "");
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => { setName(teamName ?? ""); }, [teamName]);

  const clean = name.trim();
  const dirty = clean !== (teamName ?? "");
  const valid = clean.length >= 2 && clean.length <= 24;

  const save = () => {
    if (!valid) return;
    setTeamName(clean);
    toast.success("Team name updated");
  };

  return (
    <div className="animate-float-up space-y-6 max-w-lg">
      <header>
        <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Franchise</div>
        <h1 className="mt-1 font-display text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">Your username and team name are the same — one identity across the league.</p>
      </header>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-[var(--shadow-card)] space-y-4">
        <div>
          <label htmlFor="team-name" className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Username / Team name
          </label>
          <input
            id="team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="e.g. Coach Razor's Renegades"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>2–24 characters</span>
            <span>{clean.length}/24</span>
          </div>
        </div>

        <button
          onClick={save}
          disabled={!dirty || !valid}
          className="w-full rounded-lg bg-[image:var(--gradient-gold)] px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
      </section>

      <p className="text-xs text-muted-foreground">
        Current: <span className="text-foreground font-semibold">{teamName ?? "Your Squad"}</span>
      </p>

      <section className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-destructive">Developer tools</div>
          <h2 className="mt-1 font-display text-xl">Reset test account</h2>
          <p className="mt-1 text-xs text-muted-foreground">Clears this account's roster, lineup, currency, packs, record, and season results so testing can start fresh at any time.</p>
        </div>
        {confirmReset ? (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setConfirmReset(false)} className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm">Cancel</button>
            <button
              onClick={() => {
                resetAll();
                setConfirmReset(false);
                toast.success("Test account reset");
              }}
              className="rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground"
            >
              Confirm reset
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} className="w-full rounded-lg border border-destructive/60 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10">
            Reset account data
          </button>
        )}
      </section>
    </div>
  );
}
