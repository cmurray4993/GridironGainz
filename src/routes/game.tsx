import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { fetchTodayOfficialGame } from "@/lib/game/authoritative";
import { refreshAuthoritativeState, useGame } from "@/lib/game/store";
import {
  LINEUP_SLOTS,
  playerArchetype,
  type AuthoritativeLeagueTeam,
  type AuthoritativeSeasonGame,
  type Player,
} from "@/lib/game/types";
import { lineupOverall } from "@/lib/game/sim";

export const Route = createFileRoute("/game")({
  component: GamePage,
  head: () => ({ meta: [{ title: "Matchday — Gridiron Gainz" }] }),
});

type TodayGame = {
  game: AuthoritativeSeasonGame;
  opponent: AuthoritativeLeagueTeam;
  opponentTopPlayers: Player[];
  isHome: boolean;
};

function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function until(target: string, now: number) {
  const remaining = Math.max(0, new Date(target).getTime() - now);
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `${hours}h ${minutes}m ${seconds}s`;
}

function GamePage() {
  const state = useGame();
  const now = useClock();
  const [today, setToday] = useState<TodayGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lineupPlayers = useMemo(
    () =>
      LINEUP_SLOTS.map((slot) =>
        state.lineup[slot]
          ? (state.roster.find((player) => player.id === state.lineup[slot]) ?? null)
          : null,
      ),
    [state.lineup, state.roster],
  );
  const teamOverall = lineupOverall(lineupPlayers);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTodayOfficialGame();
      setToday(result);
      await refreshAuthoritativeState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Official game data could not be loaded");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !today)
    return <Message title="Loading official matchup" body="Checking the game server…" />;
  if (error && !today)
    return (
      <Message
        title="Matchup unavailable"
        body={error}
        action={
          <button
            onClick={() => void load()}
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground"
          >
            Try again
          </button>
        }
      />
    );
  if (!today)
    return (
      <Message
        title="No game today"
        body="Your season may be complete or your next playoff matchup is still being determined."
        action={
          <Link
            to="/standings"
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground"
          >
            View league
          </Link>
        }
      />
    );

  const game = today.game;
  const final = game.status === "final";
  const yourScore = final ? Number(today.isHome ? game.home_score : game.away_score) : null;
  const opponentScore = final ? Number(today.isHome ? game.away_score : game.home_score) : null;
  const won = final && game.winner_team_id === state.authoritative?.team.id;
  const opponentOverall = final
    ? Number(today.isHome ? game.simulation?.awayOverall : game.simulation?.homeOverall)
    : today.opponentTopPlayers.length
      ? Math.round(
          today.opponentTopPlayers.reduce((sum, player) => sum + player.overall, 0) /
            today.opponentTopPlayers.length,
        )
      : today.opponent.bot_overall;
  const playByPlay = game.simulation?.playByPlay ?? [];

  return (
    <div className="animate-float-up space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">
            Official Matchday
          </div>
          <h1 className="mt-1 font-display text-3xl">
            {final ? (won ? "Victory" : "Final") : "Game Day"}
          </h1>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-border bg-secondary px-3 py-2 text-xs disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh result"}
        </button>
      </header>

      <section className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-100">
        One official result is generated and saved by the server after lineup lock. Browser
        simulations, replay rewards, and developer kickoff bypasses are disabled. This beta uses
        test assets with no cash value.
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-border/70 field-bg p-5">
        <div className="grid grid-cols-3 items-center gap-4">
          <ScoreTeam
            label={state.teamName ?? "Your Squad"}
            score={yourScore}
            overall={teamOverall || undefined}
            accent="text-gradient-gold"
          />
          <div className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-border bg-background/70 font-display">
              VS
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              {final
                ? "Final"
                : game.status === "bye"
                  ? "Bye"
                  : `Locks in ${until(game.lock_at, now)}`}
            </div>
          </div>
          <ScoreTeam
            label={today.opponent.name}
            score={opponentScore}
            overall={opponentOverall}
            accent="text-[oklch(0.72_0.2_28)]"
          />
        </div>
      </section>

      {!final && (
        <section className="rounded-xl border border-border/70 bg-card/70 p-4">
          <div className="text-[10px] uppercase tracking-widest text-primary">Lineup lock</div>
          <div className="mt-1 font-display text-2xl tabular-nums">{until(game.lock_at, now)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Your last server-saved lineup at lock time will be used. Changes after lock cannot
            affect this game.
          </p>
          <Link
            to="/lineup"
            className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Set lineup
          </Link>
        </section>
      )}

      <section className="rounded-xl border border-border/70 bg-card/70 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-primary">
              Opponent scouting
            </div>
            <h2 className="mt-1 font-display text-xl">Top three rated starters</h2>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {today.opponent.wins}-{today.opponent.losses}
            <br />
            Server verified
          </div>
        </div>
        {today.opponentTopPlayers.length ? (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
            {today.opponentTopPlayers.map((player) => (
              <div key={player.id} className="min-w-0">
                <PlayerCard player={player} compact className="mx-auto max-w-[130px]" />
                <div className="mt-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                  {playerArchetype(player)} · {player.signature.label} {player.signature.value}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            The opponent has not saved three starters yet.
          </div>
        )}
      </section>

      {final && (
        <section className="rounded-xl border border-border/70 bg-card/70 p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Server game report
          </div>
          <ol className="mt-3 space-y-2">
            {playByPlay.map((line, index) => (
              <li
                key={`${index}-${line}`}
                className="rounded-lg border border-border/50 bg-background/40 p-3 text-sm"
              >
                {line}
              </li>
            ))}
          </ol>
          <div className="mt-3 text-xs text-muted-foreground">
            Algorithm version {String(game.simulation?.algorithmVersion ?? "—")} ·{" "}
            {game.simulation?.missedLineupRule ?? "Saved lineups were used."}
          </div>
        </section>
      )}

      <div className="flex gap-2">
        <Link
          to="/standings"
          className="flex-1 rounded-lg bg-[image:var(--gradient-gold)] px-4 py-3 text-center font-semibold text-primary-foreground"
        >
          View league
        </Link>
        <Link
          to="/rules"
          className="rounded-lg border border-border bg-secondary px-4 py-3 text-sm"
        >
          Beta rules
        </Link>
      </div>
    </div>
  );
}

function ScoreTeam({
  label,
  score,
  overall,
  accent,
}: {
  label: string;
  score: number | null;
  overall?: number;
  accent: string;
}) {
  return (
    <div className="text-center">
      <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`font-display text-6xl leading-none tabular-nums ${accent}`}>
        {score ?? "—"}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        OVR {overall ? Math.round(overall) : "—"}
      </div>
    </div>
  );
}

function Message({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/80 p-8 text-center shadow-[var(--shadow-card)]">
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}
