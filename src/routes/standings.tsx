import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useGame } from "@/lib/game/store";
import {
  LEAGUES,
  LEAGUE_ORDER,
  PLAYOFF_ROUND_NAMES,
  PLAYOFF_TEAMS,
  PROMOTE_COUNT,
  RELEGATE_COUNT,
  REG_DAYS,
  SEASON_DAYS,
  TEAMS_PER_LEAGUE,
  TOTAL_SEASON_POT_SOL,
  formatCountdownDays,
  formatSol,
  generateStandings,
  generatePlayoffBracket,
  seasonInfo,
  solPrizeFor,
  type LeagueTier,
} from "@/lib/game/season";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/standings")({
  head: () => ({
    meta: [
      { title: "Standings — Gridiron Gainz" },
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
  const seasonPool = state.currentPrizePoolSol ?? TOTAL_SEASON_POT_SOL;
  const now = Date.now();
  const msToPlayoffs = info.playoffsStartAt - now;
  const msToChampionship = info.championshipAt - now;
  const msToNextSeason = info.nextSeasonAt - now;

  const standings = generateStandings({
    tier,
    seasonNumber: info.seasonNumber,
    regularDay: info.regularDay,
    you: { wins: state.wins, losses: state.losses, pointsFor: state.pointsFor, pointsAgainst: state.pointsAgainst },
  });
  const yourIdx = standings.findIndex((r) => r.isYou);
  const bracket = generatePlayoffBracket(standings, state.officialResults ?? [], info.seasonNumber, info.dayOfSeason);
  const seedOf = (id: string) => bracket.seeds.findIndex((team) => team.id === id) + 1;

  return (
    <div className="animate-float-up space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-2xl border border-border/70 field-bg p-6 shadow-[var(--shadow-card)]">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Season {info.seasonNumber} · Day {info.dayOfSeason}/{SEASON_DAYS}</div>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl">Standings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seven games in seven days. The top {PLAYOFF_TEAMS} advance to a three-day, single-elimination playoff.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SeasonStat label={info.isPlayoffs ? "Playoff round" : "Regular season"} value={info.isPlayoffs ? PLAYOFF_ROUND_NAMES[info.playoffRound - 1] : `Game ${info.regularDay}/${REG_DAYS}`} sub={info.isPlayoffs ? `Round ${info.playoffRound}/3` : `${REG_DAYS - info.regularDay} games left`} />
          <SeasonStat label={info.isPlayoffs ? "Championship in" : "Playoffs start in"} value={formatCountdownDays(info.isPlayoffs ? msToChampionship : msToPlayoffs)} sub="One game = one real day" />
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
            <div>Champion payout: <span className="text-primary font-semibold">◎ {formatSol(solPrizeFor(tier, 1, seasonPool).sol)} SOL</span></div>
            <div>Last place: <span className="text-foreground font-semibold">◎ {formatSol(solPrizeFor(tier, TEAMS_PER_LEAGUE, seasonPool).sol)} SOL</span></div>
          </div>
        </div>
      </section>

      {/* Standings table */}
      <section className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">Standings</h2>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Top {PLAYOFF_TEAMS} qualify · Bottom 4 eliminated
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
                <th className="py-2 px-2 text-right">SOL</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => {
                const pos = i + 1;
                const promote = pos <= PROMOTE_COUNT;
                const playoff = pos <= PLAYOFF_TEAMS;
                const relegate = pos > standings.length - RELEGATE_COUNT;
                const prize = solPrizeFor(tier, pos, seasonPool);
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-t border-border/50",
                      row.isYou && "bg-primary/10",
                      !row.isYou && promote && "bg-emerald-500/5",
                      !row.isYou && relegate && "bg-red-500/5",
                    )}
                  >
                    <td className="py-2 px-2 text-muted-foreground tabular-nums">
                      <span className={cn(
                        "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        promote && "bg-emerald-500/20 text-emerald-300",
                        playoff && !promote && "bg-sky-500/20 text-sky-300",
                        relegate && "bg-red-500/20 text-red-300",
                        !playoff && !relegate && "text-muted-foreground",
                      )}>{pos}</span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={cn("font-semibold", row.isYou && "text-primary")}>{row.name}</span>
                      {pos === 1 && <span className="ml-2 text-[10px] uppercase tracking-widest text-primary">Champion</span>}
                      {playoff && <span className="ml-2 text-[10px] uppercase tracking-widest text-sky-300">Playoffs</span>}
                      {promote && pos !== 1 && <span className="ml-2 text-[10px] uppercase tracking-widest text-emerald-300">↑ Promote</span>}
                      {relegate && <span className="ml-2 text-[10px] uppercase tracking-widest text-red-300">↓ Drop</span>}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{row.wins}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{row.losses}</td>
                    <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell">{row.pointsFor}</td>
                    <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell">{row.pointsAgainst}</td>
                    <td className={cn("py-2 px-2 text-right tabular-nums font-semibold", row.pointsFor - row.pointsAgainst > 0 ? "text-emerald-400" : row.pointsFor - row.pointsAgainst < 0 ? "text-red-400" : "text-muted-foreground")}>
                      {row.pointsFor - row.pointsAgainst > 0 ? "+" : ""}{row.pointsFor - row.pointsAgainst}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-primary/90">
                      ◎ {formatSol(prize.sol)}
                      <div className="text-[9px] text-muted-foreground">{prize.pct.toFixed(2)}%</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {yourIdx >= 0 && (
          <div className="mt-3 text-[11px] text-muted-foreground">
            You're sitting <span className="text-foreground font-semibold">#{yourIdx + 1}</span> of {standings.length}. {yourIdx < PROMOTE_COUNT ? "In promotion zone." : yourIdx >= standings.length - RELEGATE_COUNT ? "Watch out — relegation zone." : `${yourIdx - (PROMOTE_COUNT - 1)} spot${yourIdx - (PROMOTE_COUNT - 1) === 1 ? "" : "s"} out of promotion.`}
          </div>
        )}
      </section>

      {/* Playoff schedule */}
      <section className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl">Playoff bracket</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">Three straight days. Every game at 7:00 PM Central. Lose and you're out.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {PLAYOFF_ROUND_NAMES.map((name, i) => {
            const dayIdx = REG_DAYS + i + 1;
            const active = info.isPlayoffs && info.playoffRound === i + 1;
            const past = info.dayOfSeason > dayIdx;
            return (
              <div key={name} className={cn(
                "rounded-lg border p-3",
                active ? "border-primary bg-primary/10 shadow-[var(--shadow-glow)]"
                       : past ? "border-border/40 bg-background/30 opacity-60"
                       : "border-border/60 bg-background/50",
              )}>
                <div className="text-center text-[10px] uppercase tracking-widest text-muted-foreground">Day {dayIdx}</div>
                <div className={cn("mt-1 text-center font-display", i === PLAYOFF_ROUND_NAMES.length - 1 ? "text-lg text-gradient-gold" : "text-base")}>{name}</div>
                <div className="mt-3 space-y-2">
                  {bracket.rounds[i].length ? bracket.rounds[i].map((match) => (
                    <div key={match.id} className="rounded border border-border/60 bg-background/50 px-2 py-2 text-xs">
                      {[match.home, match.away].map((team) => (
                        <div key={team.id} className={cn("flex items-center gap-2", match.winner?.id === team.id && "font-semibold text-primary", team.isYou && "text-amber-200")}>
                          <span className="w-5 text-right text-[10px] text-muted-foreground">#{seedOf(team.id)}</span>
                          <span className="min-w-0 flex-1 truncate">{team.name}</span>
                          {match.winner?.id === team.id && <span>✓</span>}
                        </div>
                      ))}
                      <div className="mt-1 text-center text-[10px] text-muted-foreground">{match.score ?? (active ? "Tonight · 7:00 PM CT" : "TBD")}</div>
                    </div>
                  )) : <div className="rounded border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground">Awaiting previous round</div>}
                </div>
              </div>
            );
          })}
        </div>
        {!bracket.userQualified && info.isPlayoffs && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">Your season ended outside the top eight.</div>}
        {bracket.userEliminated && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">Your franchise has been eliminated from the playoffs.</div>}
        {bracket.champion && <div className="mt-3 rounded-lg border border-primary/40 bg-primary/10 p-4 text-center font-display text-xl text-gradient-gold">Champion: {bracket.champion.name}</div>}
      </section>

      {/* Prize + promotion ladder */}
      <section className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-xl">SOL prize pool</h2>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total per season</div>
            <div className="font-display text-lg text-gradient-gold">◎ {formatSol(seasonPool)} SOL</div>
            <div className="text-[9px] text-muted-foreground">Next season ◎ {formatSol(state.nextSeasonPoolSol ?? 0)}</div>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Every seat in every league gets a share of the pot at season end. Top {PROMOTE_COUNT} promote, bottom {RELEGATE_COUNT} relegate.
        </p>
        <div className="mt-3 space-y-2">
          {[...LEAGUE_ORDER].reverse().map((t) => {
            const meta = LEAGUES[t];
            const active = t === tier;
            const tierNum = LEAGUE_ORDER.indexOf(t) + 1;
            const champ = solPrizeFor(t, 1, seasonPool);
            const last = solPrizeFor(t, TEAMS_PER_LEAGUE, seasonPool);
            const tierTotal = Array.from({ length: TEAMS_PER_LEAGUE }, (_, i) => solPrizeFor(t, i + 1, seasonPool).sol).reduce((a, b) => a + b, 0);
            return (
              <div key={t} className={cn(
                "rounded-lg border p-3",
                active ? "border-primary bg-primary/10" : "border-border/60 bg-background/40",
              )}>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg text-xl" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-base truncate">Tier {tierNum} · {meta.name}</div>
                    <div className="text-[10px] text-muted-foreground">Tier share ◎ {formatSol(tierTotal)} SOL · Win {meta.regularWin} 🪙</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Champion</div>
                    <div className="font-display text-lg text-gradient-gold">◎ {formatSol(champ.sol)}</div>
                    <div className="text-[9px] text-muted-foreground">{champ.pct.toFixed(2)}%</div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-6 gap-1 text-[9px] tabular-nums sm:grid-cols-12">
                  {Array.from({ length: TEAMS_PER_LEAGUE }, (_, i) => {
                    const pos = i + 1;
                    const p = solPrizeFor(t, pos, seasonPool);
                    const promote = pos <= PROMOTE_COUNT;
                    const relegate = pos > TEAMS_PER_LEAGUE - RELEGATE_COUNT;
                    return (
                      <div key={pos} className={cn(
                        "rounded border px-1 py-1 text-center",
                        promote ? "border-emerald-500/40 bg-emerald-500/10"
                               : relegate ? "border-red-500/40 bg-red-500/10"
                               : "border-border/50 bg-background/40",
                      )}>
                        <div className="text-muted-foreground">#{pos}</div>
                        <div className="font-semibold text-foreground">◎{formatSol(p.sol)}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
                  <span>Champion ◎ {formatSol(champ.sol)}</span>
                  <span>Last ◎ {formatSol(last.sol)}</span>
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
