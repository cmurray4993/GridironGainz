import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useGame } from "@/lib/game/store";
import type { AuthoritativeSeasonGame } from "@/lib/game/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/standings")({
  head: () => ({
    meta: [
      { title: "League — Gridiron Gainz" },
      { name: "description", content: "Official server-recorded season standings and schedule." },
    ],
  }),
  component: StandingsPage,
});

const ROUND_LABELS: Record<AuthoritativeSeasonGame["round"], string> = {
  regular: "Regular season",
  quarterfinal: "Quarterfinal",
  semifinal: "Semifinal",
  championship: "Championship",
  consolation: "Consolation",
};

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function countdown(target: string, now: number) {
  const remaining = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  if (days) return `${days}d ${hours}h ${minutes}m`;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function StandingsPage() {
  const state = useGame();
  const official = state.authoritative;
  const now = useNow();

  const teamNames = useMemo(
    () => new Map((official?.standings ?? []).map((team) => [team.id, team.name])),
    [official?.standings],
  );
  const nextGame = useMemo(
    () =>
      (official?.games ?? [])
        .filter(
          (game) =>
            game.status === "scheduled" &&
            (game.home_team_id === official?.team.id || game.away_team_id === official?.team.id),
        )
        .sort((a, b) => new Date(a.lock_at).getTime() - new Date(b.lock_at).getTime())[0],
    [official?.games, official?.team.id],
  );

  if (!official) {
    return (
      <section className="rounded-2xl border border-border/70 bg-card/80 p-6 text-center shadow-[var(--shadow-card)]">
        <h1 className="font-display text-2xl">League data unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Official standings could not be loaded. Refresh after signing in; no local substitute will
          be generated.
        </p>
      </section>
    );
  }

  const poolLamports = Number(official.season.prizePoolLamports ?? 0);
  const poolTestSol = poolLamports / 1_000_000_000;

  return (
    <div className="animate-float-up space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 field-bg p-6 shadow-[var(--shadow-card)]">
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">
          Season {official.season.number} · Day {official.season.day}/10
        </div>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl">Official League</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Seven daily games followed by an eight-team, three-round playoff. Results, standings,
          lineup locks, and rewards shown here come from the game server.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SeasonStat
            label="Your record"
            value={`${official.team.wins}-${official.team.losses}`}
            sub={`${official.team.points_for} PF · ${official.team.points_against} PA`}
          />
          <SeasonStat
            label={nextGame ? "Next lineup lock" : "Schedule"}
            value={nextGame ? countdown(nextGame.lock_at, now) : "Complete"}
            sub={
              nextGame ? new Date(nextGame.lock_at).toLocaleString() : "No scheduled games remain"
            }
          />
          <SeasonStat
            label="Beta reward pool"
            value={`${poolTestSol.toFixed(3)} test SOL`}
            sub="Devnet only · no cash value"
          />
        </div>
      </section>

      <section className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
        <div className="font-semibold">Testing notice</div>
        <p className="mt-1 text-xs text-amber-100/80">
          This beta uses devnet test assets only. Purchases do not fund prizes, and test SOL,
          Gridiron Cash, Coins, cards, and rewards have no cash value.
        </p>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl">Standings</h2>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Top 8 qualify
          </span>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border/60">
          <table className="min-w-[560px] w-full text-sm">
            <thead className="bg-background/60 text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Seed</th>
                <th className="px-3 py-2 text-left">Franchise</th>
                <th className="px-3 py-2 text-right">W</th>
                <th className="px-3 py-2 text-right">L</th>
                <th className="px-3 py-2 text-right">PF</th>
                <th className="px-3 py-2 text-right">PA</th>
                <th className="px-3 py-2 text-right">Diff</th>
              </tr>
            </thead>
            <tbody>
              {official.standings.map((team, index) => {
                const seed = index + 1;
                const isYou = team.id === official.team.id;
                const diff = team.points_for - team.points_against;
                return (
                  <tr
                    key={team.id}
                    className={cn("border-t border-border/50", isYou && "bg-primary/10")}
                  >
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px]",
                          seed <= 8 ? "bg-sky-500/20 text-sky-200" : "text-muted-foreground",
                        )}
                      >
                        #{seed}
                      </span>
                    </td>
                    <td className={cn("px-3 py-2 font-semibold", isYou && "text-primary")}>
                      {team.name}
                      {isYou ? " (You)" : ""}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{team.wins}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{team.losses}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{team.points_for}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{team.points_against}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-semibold tabular-nums",
                        diff > 0
                          ? "text-emerald-400"
                          : diff < 0
                            ? "text-red-400"
                            : "text-muted-foreground",
                      )}
                    >
                      {diff > 0 ? "+" : ""}
                      {diff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl">Official schedule</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Lineups lock at the server time shown for each game.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((day) => {
            const games = official.games.filter((game) => game.day_number === day);
            const label = games[0]
              ? ROUND_LABELS[games[0].round]
              : day <= 7
                ? "Regular season"
                : "Playoffs";
            return (
              <div
                key={day}
                className={cn(
                  "rounded-xl border p-3",
                  day === official.season.day
                    ? "border-primary bg-primary/10"
                    : "border-border/60 bg-background/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display">Day {day}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {label}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {games.length === 0 ? (
                    <div className="rounded border border-dashed border-border/50 p-3 text-center text-xs text-muted-foreground">
                      Awaiting qualification
                    </div>
                  ) : (
                    games.map((game) => (
                      <GameRow
                        key={game.id}
                        game={game}
                        names={teamNames}
                        yourTeamId={official.team.id}
                        now={now}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {official.rewards.length > 0 && (
        <section className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-xl">Recorded rewards</h2>
          <div className="mt-3 space-y-2">
            {official.rewards.map((reward) => (
              <div
                key={reward.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3 text-sm"
              >
                <span>Final rank #{reward.final_rank}</span>
                <span className="text-right font-semibold">
                  {reward.coins.toLocaleString()} Coins
                  {reward.sol_lamports > 0
                    ? ` · ${(reward.sol_lamports / 1_000_000_000).toFixed(3)} test SOL`
                    : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          to="/game"
          className="flex-1 min-w-[140px] rounded-lg bg-[image:var(--gradient-gold)] px-4 py-3 text-center font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-95"
        >
          Today's matchup
        </Link>
        <Link
          to="/lineup"
          className="rounded-lg border border-border bg-secondary px-4 py-3 text-center text-sm hover:bg-secondary/70"
        >
          Set lineup
        </Link>
        <Link
          to="/rules"
          className="rounded-lg border border-border bg-secondary px-4 py-3 text-center text-sm hover:bg-secondary/70"
        >
          Official beta rules
        </Link>
      </div>
    </div>
  );
}

function GameRow({
  game,
  names,
  yourTeamId,
  now,
}: {
  game: AuthoritativeSeasonGame;
  names: Map<string, string>;
  yourTeamId: string;
  now: number;
}) {
  const involvesYou = game.home_team_id === yourTeamId || game.away_team_id === yourTeamId;
  const home = names.get(game.home_team_id) ?? "TBD";
  const away = names.get(game.away_team_id) ?? "TBD";
  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-background/60 p-2 text-xs",
        involvesYou && "border-primary/50",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{home}</span>
        <span className="font-semibold tabular-nums">
          {game.status === "final" ? game.home_score : "—"}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{away}</span>
        <span className="font-semibold tabular-nums">
          {game.status === "final" ? game.away_score : "—"}
        </span>
      </div>
      <div className="mt-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
        {game.status === "final"
          ? "Final"
          : game.status === "bye"
            ? "Bye"
            : `Locks in ${countdown(game.lock_at, now)}`}
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
