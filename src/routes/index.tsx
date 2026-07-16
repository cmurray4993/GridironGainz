import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  claimCoins,
  MAX_CLAIM_BUCKETS,
  pendingClaim,
  useGame,
} from "@/lib/game/store";
import { COIN_PER_FAN_PER_HOUR } from "@/lib/game/types";
import { lineupOverall, pickTodaysOpponent } from "@/lib/game/sim";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const state = useGame();

  // Re-render every second so the pending-claim tile stays live.
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const roster = state.roster;
  const lineupPlayers = useMemo(
    () => Object.values(state.lineup).map((id) => (id ? roster.find((p) => p.id === id) ?? null : null)),
    [state.lineup, roster],
  );
  const teamOverall = lineupOverall(lineupPlayers) || (roster.length ? Math.round(roster.reduce((s, p) => s + p.overall, 0) / roster.length) : 60);
  const opponent = useMemo(() => pickTodaysOpponent(teamOverall), [teamOverall]);
  const coinsPerHour = state.fans * COIN_PER_FAN_PER_HOUR;

  const pend = pendingClaim();
  const canClaim = pend.buckets > 0;

  return (
    <div className="animate-float-up space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 field-bg p-6 shadow-[var(--shadow-card)]">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Franchise HQ</div>
        <h1 className="mt-1 font-display text-4xl sm:text-5xl">Fourth &amp; Fortune</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">Build a squad. Court the crowd. Chase the fourth-down miracle.</p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <BigStat label="Franchise Fans" value={fmt(state.fans)} accent="fan" sub={`+${coinsPerHour.toFixed(2)} 🪙/hr`} />
          <BigStat label="Coins" value={state.coins.toFixed(2)} accent="gold" sub={`${COIN_PER_FAN_PER_HOUR} 🪙 per fan / hr`} />
          <BigStat label="Record" value={`${state.wins}–${state.losses}`} sub={`${state.packsOpened} packs opened`} />
        </div>

        <ClaimTile
          pend={pend}
          canClaim={canClaim}
          fans={state.fans}
          onClaim={() => claimCoins()}
        />
      </section>


      <section className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Today's matchup</div>
            <h2 className="mt-1 font-display text-2xl">Your Squad <span className="text-muted-foreground">vs</span> {opponent.name}</h2>
          </div>
          <div className="hidden sm:block text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Kickoff</div>
            <div className="font-display text-lg">Tonight</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 items-center gap-4">
          <TeamCard label="Your OVR" value={teamOverall} tone="gold" />
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-border/70 bg-background/60 font-display text-lg">VS</div>
            <div className="mt-2 text-xs text-muted-foreground">Difficulty {rank(opponent.overall - teamOverall)}</div>
          </div>
          <TeamCard label="Opponent OVR" value={opponent.overall} tone="ember" />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/game" className="flex-1 min-w-[140px] rounded-lg bg-[image:var(--gradient-gold)] px-4 py-3 text-center font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-95">
            Play matchup
          </Link>
          <Link to="/lineup" className="rounded-lg border border-border bg-secondary px-4 py-3 text-center text-sm hover:bg-secondary/70">
            Set lineup
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <ActionCard to="/pack" title="Open a pack" description="5 cards. Chance of legendary pull." emoji="🎴" cta="Go to store" />
        <ActionCard to="/roster" title="Your roster" description={`${roster.length} player${roster.length === 1 ? "" : "s"} signed to the franchise.`} emoji="👥" cta="View roster" />
      </section>
    </div>
  );
}

function BigStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "gold" | "fan" }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl ${accent === "gold" ? "text-gradient-gold" : accent === "fan" ? "text-[oklch(0.75_0.18_25)]" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function TeamCard({ label, value, tone }: { label: string; value: number; tone: "gold" | "ember" }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/60 p-4 text-center">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-4xl ${tone === "gold" ? "text-gradient-gold" : "text-[oklch(0.72_0.2_28)]"}`}>{value}</div>
    </div>
  );
}

function rank(delta: number) {
  if (delta <= -10) return "Cakewalk";
  if (delta <= -3) return "Favored";
  if (delta < 3) return "Even";
  if (delta < 10) return "Underdog";
  return "Long shot";
}
function fmt(n: number) { return n.toLocaleString(); }

function ActionCard({ to, title, description, emoji, cta }: { to: string; title: string; description: string; emoji: string; cta: string }) {
  return (
    <Link to={to} className="group rounded-xl border border-border/70 bg-card/80 p-4 hover:border-primary/60 transition-colors">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-xl">{emoji}</div>
        <div className="flex-1">
          <div className="font-display text-lg">{title}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
          <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-primary group-hover:underline">{cta} →</div>
        </div>
      </div>
    </Link>
  );
}
