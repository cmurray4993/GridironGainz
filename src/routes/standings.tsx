import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useGame } from "@/lib/game/store";
import {
  LEAGUES,
  LEAGUE_ORDER,
  PLAYOFF_ROUND_NAMES,
  PROMOTE_COUNT,
  RELEGATE_COUNT,
  REG_DAYS,
  SEASON_DAYS,
  TEAMS_PER_LEAGUE,
  TOTAL_SEASON_POT_SOL,
  formatCountdownDays,
  formatSol,
  generateStandings,
  seasonInfo,
  solPrizeFor,
  type LeagueTier,
} from "@/lib/game/season";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/standings")({
  head: () => ({
    meta: [
      { title: "Standings — Fourth & Fortune" },
      { name: "description", content: "League standings, playoff schedule, and prizes across all five tiers." },
    ],
  }),
  component: StandingsPage,
});

const LEAGUE_KEY = "faf.league.v1";

function useLeagueTier(): [LeagueTier, (t: LeagueTier) => void] {
  const [tier, setTier] = useState<LeagueTier>("backyard");
  useEffect(() => {
    try {
      const v = localStorage.getItem(LEAGUE_KEY) as LeagueTier | null;
      if (v && v in LEAGUES) setTier(v);
    } catch { /* noop */ }
  }, []);
  const update = (t: LeagueTier) => {
    setTier(t);
    try { localStorage.setItem(LEAGUE_KEY, t); } catch { /* noop */ }
  };
  return [tier, update];
}

function StandingsPage() {
  const state = useGame();
  const [tier, setTier] = useLeagueTier();
  const league = LEAGUES[tier];

  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(i); }, []);

  const info = seasonInfo();
  const now = Date.now();
  const msToPlayoffs = info.playoffsStartAt - now;
  const msToSuperBowl = info.superBowlAt - now;
  const msToNextSeason = info.nextSeasonAt - now;

  const standings = generateStandings({
    tier,
    seasonNumber: info.seasonNumber,
    regularDay: info.regularDay,
    you: { wins: state.wins, losses: state.losses },
  });
  const yourIdx = standings.findIndex((r) => r.isYou);

  return (
    <div className="animate-float-up space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-2xl border border-border/70 field-bg p-6 shadow-[var(--shadow-card)]">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Season {info.seasonNumber} · Day {info.dayOfSeason}/{SEASON_DAYS}</div>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl">Standings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          16-day regular season. Top 8 make a 4-day playoff. Bottom two teams get relegated. Champions promote.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SeasonStat label={info.isPlayoffs ? "Playoff round" : "Regular season"} value={info.isPlayoffs ? PLAYOFF_ROUND_NAMES[info.playoffRound - 1] : `Week ${info.regularDay}/${REG_DAYS}`} sub={info.isPlayoffs ? `Round ${info.playoffRound}/4` : `${REG_DAYS - info.regularDay} weeks left`} />
          <SeasonStat label={info.isPlayoffs ? "Super Bowl in" : "Playoffs start in"} value={formatCountdownDays(info.isPlayoffs ? msToSuperBowl : msToPlayoffs)} sub="One week = one real day" />
          <SeasonStat label="Next season" value={formatCountdownDays(msToNextSeason)} sub="Promotions & relegations apply" />
        </div>
      </section>

      {/* League tier switcher */}
      <section className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-[var(--shadow-card)]">
        <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Your league</div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {LEAGUE_ORDER.map((t, i) => {
            const meta = LEAGUES[t];
            const active = t === tier;
            return (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] uppercase tracking-widest transition-colors",
                  active ? "border-primary bg-primary/10 text-primary shadow-[var(--shadow-glow)]" : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground",
                )}
                title={meta.name}
              >
                <span className="text-lg leading-none">{meta.emoji}</span>
                <span className="leading-tight">T{i + 1}</span>
                <span className="hidden sm:block">{meta.short}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <div>
            <div className="font-display text-lg" style={{ color: league.color }}>{league.emoji} {league.name}</div>
            <div className="text-[11px] text-muted-foreground">Tier {LEAGUE_ORDER.indexOf(tier) + 1} of 5</div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            <div>Win: <span className="text-foreground font-semibold">{league.regularWin} 🪙</span> · +{league.fanBonus} 🎟️</div>
            <div>Champion payout: <span className="text-primary font-semibold">◎ {formatSol(solPrizeFor(tier, 1).sol)} SOL</span></div>
            <div>Last place: <span className="text-foreground font-semibold">◎ {formatSol(solPrizeFor(tier, TEAMS_PER_LEAGUE).sol)} SOL</span></div>
          </div>
        </div>
      </section>

      {/* Standings table */}
      <section className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">Standings</h2>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Top 8 make playoffs · Bottom 2 relegate
          </div>
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-background/60 text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="py-2 px-2 text-left w-8">#</th>
                <th className="py-2 px-2 text-left">Team</th>
                <th className="py-2 px-2 text-right">W</th>
                <th className="py-2 px-2 text-right">L</th>
                <th className="py-2 px-2 text-right hidden sm:table-cell">PF</th>
                <th className="py-2 px-2 text-right hidden sm:table-cell">PA</th>
                <th className="py-2 px-2 text-right">Diff</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => {
                const playoff = i < 8;
                const relegate = i >= standings.length - 2;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-t border-border/50",
                      row.isYou && "bg-primary/10",
                      !row.isYou && playoff && "bg-emerald-500/5",
                      !row.isYou && relegate && "bg-red-500/5",
                    )}
                  >
                    <td className="py-2 px-2 text-muted-foreground tabular-nums">
                      <span className={cn(
                        "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        playoff && "bg-emerald-500/20 text-emerald-300",
                        relegate && "bg-red-500/20 text-red-300",
                        !playoff && !relegate && "text-muted-foreground",
                      )}>{i + 1}</span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={cn("font-semibold", row.isYou && "text-primary")}>{row.name}</span>
                      {i === 0 && <span className="ml-2 text-[10px] uppercase tracking-widest text-primary">#1 Seed</span>}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{row.wins}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{row.losses}</td>
                    <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell">{row.pointsFor}</td>
                    <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell">{row.pointsAgainst}</td>
                    <td className={cn("py-2 px-2 text-right tabular-nums font-semibold", row.pointsFor - row.pointsAgainst > 0 ? "text-emerald-400" : row.pointsFor - row.pointsAgainst < 0 ? "text-red-400" : "text-muted-foreground")}>
                      {row.pointsFor - row.pointsAgainst > 0 ? "+" : ""}{row.pointsFor - row.pointsAgainst}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {yourIdx >= 0 && (
          <div className="mt-3 text-[11px] text-muted-foreground">
            You're sitting <span className="text-foreground font-semibold">#{yourIdx + 1}</span> of {standings.length}. {yourIdx < 8 ? "In playoff position." : yourIdx >= standings.length - 2 ? "Watch out — relegation zone." : `${8 - yourIdx > 0 ? `${yourIdx - 7} spots out of a playoff berth` : ""}`}
          </div>
        )}
      </section>

      {/* Playoff schedule */}
      <section className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl">Playoff bracket</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">Four straight days. Every game at 7:00 PM Central. Lose and you're out.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLAYOFF_ROUND_NAMES.map((name, i) => {
            const dayIdx = REG_DAYS + i + 1;
            const active = info.isPlayoffs && info.playoffRound === i + 1;
            const past = info.dayOfSeason > dayIdx;
            return (
              <div key={name} className={cn(
                "rounded-lg border p-3 text-center",
                active ? "border-primary bg-primary/10 shadow-[var(--shadow-glow)]"
                       : past ? "border-border/40 bg-background/30 opacity-60"
                       : "border-border/60 bg-background/50",
              )}>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Day {dayIdx}</div>
                <div className={cn("mt-1 font-display", i === 3 ? "text-lg text-gradient-gold" : "text-base")}>{name}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">{i === 0 ? "16 → 8" : i === 1 ? "8 → 4" : i === 2 ? "4 → 2" : "🏆 Champion"}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Prize + promotion ladder */}
      <section className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl">League ladder & prizes</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">Win your league to promote. Finish last two to drop a tier next season.</p>
        <div className="mt-3 space-y-2">
          {[...LEAGUE_ORDER].reverse().map((t) => {
            const meta = LEAGUES[t];
            const active = t === tier;
            const tierNum = LEAGUE_ORDER.indexOf(t) + 1;
            return (
              <div key={t} className={cn(
                "flex items-center gap-3 rounded-lg border p-3",
                active ? "border-primary bg-primary/10" : "border-border/60 bg-background/40",
              )}>
                <div className="grid h-10 w-10 place-items-center rounded-lg text-xl" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-base truncate">Tier {tierNum} · {meta.name}</div>
                  <div className="text-[10px] text-muted-foreground">Win {meta.regularWin} 🪙 · Playoff {meta.playoffPrize} 🪙</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Champion</div>
                  <div className="font-display text-lg text-gradient-gold">{meta.championPrize.toLocaleString()} 🪙</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link to="/game" className="flex-1 min-w-[140px] rounded-lg bg-[image:var(--gradient-gold)] px-4 py-3 text-center font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-95">To matchup</Link>
        <Link to="/lineup" className="rounded-lg border border-border bg-secondary px-4 py-3 text-center text-sm hover:bg-secondary/70">Set lineup</Link>
      </div>
    </div>
  );
}

function SeasonStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
