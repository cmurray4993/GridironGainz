import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { recordResult, useGame } from "@/lib/game/store";
import { LINEUP_SLOTS, slotPosition } from "@/lib/game/types";
import { lineupOverall, pickTodaysOpponent, simulateGame, type SimResult, type TeamStats, type PlayerStat } from "@/lib/game/sim";
import { KickoffCountdown } from "@/components/KickoffCountdown";
import { kickoffStatus } from "@/lib/game/kickoff";

export const Route = createFileRoute("/game")({
  component: GamePage,
  head: () => ({ meta: [{ title: "Matchday — Fourth & Fortune" }] }),
});

type Phase = "ready" | "playing" | "final";

function GamePage() {
  const { lineup, roster } = useGame();
  const lineupPlayers = useMemo(
    () => LINEUP_SLOTS.map((slot) => (lineup[slot] ? roster.find((p) => p.id === lineup[slot]) ?? null : null)),
    [lineup, roster],
  );
  const filled = lineupPlayers.filter(Boolean).length;
  const teamOvr = lineupOverall(lineupPlayers);
  const opponent = useMemo(() => pickTodaysOpponent(teamOvr || 65), [teamOvr]);

  const [phase, setPhase] = useState<Phase>("ready");
  const [result, setResult] = useState<SimResult | null>(null);
  const [shown, setShown] = useState<string[]>([]);
  const [live, setLive] = useState({ home: 0, away: 0 });
  const timers = useRef<number[]>([]);
  const recorded = useRef(false);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const [kick, setKick] = useState(() => kickoffStatus());
  useEffect(() => {
    const i = setInterval(() => setKick(kickoffStatus()), 1000);
    return () => clearInterval(i);
  }, []);

  const [testMode, setTestMode] = useState(false);
  const canStart = filled > 0 && (kick.isLive || testMode);

  const start = () => {
    if (filled === 0) return;
    const r = simulateGame(lineupPlayers, opponent.overall, opponent.name);
    setResult(r);
    setShown([]);
    setLive({ home: 0, away: 0 });
    setPhase("playing");
    recorded.current = false;

    timers.current.forEach(clearTimeout);
    timers.current = [];
    let h = 0, a = 0;
    r.log.forEach((line, i) => {
      const t = window.setTimeout(() => {
        setShown((s) => [...s, line]);
        // parse score updates like "(H-A)"
        const m = line.match(/\((\d+)-(\d+)\)/);
        if (m) { h = +m[1]; a = +m[2]; setLive({ home: h, away: a }); }
        if (i === r.log.length - 1) {
          setPhase("final");
          if (!recorded.current) { recorded.current = true; recordResult(r.win); }
        }
      }, 550 * i + 400);
      timers.current.push(t);
    });
  };

  const skip = () => {
    if (!result) return;
    timers.current.forEach(clearTimeout);
    setShown(result.log);
    setLive({ home: result.homeScore, away: result.awayScore });
    setPhase("final");
    if (!recorded.current) { recorded.current = true; recordResult(result.win); }
  };

  const reset = () => { setPhase("ready"); setResult(null); setShown([]); setLive({ home: 0, away: 0 }); };

  return (
    <div className="animate-float-up space-y-5">
      <header>
        <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Matchday</div>
        <h1 className="mt-1 font-display text-3xl">{phase === "final" ? (result?.win ? "Victory" : "Defeat") : "Game Day"}</h1>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-border/70 field-bg p-5">
        <div className="grid grid-cols-3 items-center gap-4">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Your Squad</div>
            <div className="font-display text-6xl text-gradient-gold leading-none tabular-nums">{live.home}</div>
            <div className="mt-1 text-xs text-muted-foreground">OVR {teamOvr || "--"}</div>
          </div>
          <div className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-border bg-background/70 font-display">VS</div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {phase === "playing" ? "In progress" : phase === "final" ? "Final" : "Pre-game"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{opponent.name}</div>
            <div className="font-display text-6xl text-[oklch(0.72_0.2_28)] leading-none tabular-nums">{live.away}</div>
            <div className="mt-1 text-xs text-muted-foreground">OVR {opponent.overall}</div>
          </div>
        </div>
      </section>

      {phase === "ready" && (
        <section className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-card/70 p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Lineup</div>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
              {LINEUP_SLOTS.map((pos, i) => {
                const p = lineupPlayers[i];
                return (
                  <div key={pos} className={`rounded-lg border p-2 text-center text-xs ${p ? "border-border bg-secondary" : "border-dashed border-border/60 text-muted-foreground"}`}>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{pos}</div>
                    <div className="font-semibold truncate">{p ? p.name.split(" ")[1] : "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{p ? `OVR ${p.overall}` : ""}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <KickoffCountdown />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={start}
              disabled={!canStart}
              className="flex-1 min-w-[180px] rounded-lg bg-[image:var(--gradient-gold)] px-4 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-50"
            >
              {filled === 0 ? "Set a lineup first" : kick.isLive ? "Kickoff" : testMode ? "Run test kickoff" : "Locked until 7:00 PM CT"}
            </button>
            <Link to="/lineup" className="rounded-lg border border-border bg-secondary px-4 py-3 text-sm">Edit lineup</Link>
          </div>
          {!kick.isLive && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
              Dev: simulate now (bypass 7:00 PM CT lock)
            </label>
          )}
          <p className="text-xs text-muted-foreground">Matches lock in at 7:00 PM Central daily. Set your lineup before kickoff — the sim runs against another manager's squad. Speed beats strength · Strength beats IQ · IQ beats speed.</p>
        </section>
      )}

      {(phase === "playing" || phase === "final") && (
        <section className="rounded-xl border border-border/70 bg-card/70 p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Play by play</div>
            {phase === "playing" && <button onClick={skip} className="text-xs text-primary hover:underline">Skip →</button>}
          </div>
          <ol className="mt-2 space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
            {shown.map((l, i) => (
              <li key={i} className={`text-sm animate-float-up ${l.startsWith("—") ? "text-primary font-display tracking-widest text-xs uppercase pt-2" : l.startsWith("🏆") || l.startsWith("💔") ? "font-display text-lg" : "text-foreground/90"}`}>
                {l}
              </li>
            ))}
          </ol>
          {phase === "final" && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
              <button onClick={reset} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Play again</button>
              <Link to="/" className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm">Back to HQ</Link>
              <div className="ml-auto text-sm text-muted-foreground">
                {result?.win ? "+150 🪙 · +25 fans" : "+40 🪙 · +5 fans"}
              </div>
            </div>
          )}
        </section>
      )}

      {phase === "final" && result && (
        <section className="rounded-xl border border-border/70 bg-card/70 p-4 space-y-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Box score</div>
          <div className="grid grid-cols-2 gap-3">
            <TeamStatCard label="Your squad" score={result.homeScore} stats={result.homeStats} accent="text-gradient-gold" />
            <TeamStatCard label={result.opponentName} score={result.awayScore} stats={result.awayStats} accent="text-[oklch(0.72_0.2_28)]" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PlayerStatTable title="Your players" rows={result.homePlayers} />
            <PlayerStatTable title={`${result.opponentName}`} rows={result.awayPlayers} />
          </div>
          <div className="text-xs text-muted-foreground">
            Team OVR {result.homeOverall} vs {result.opponentOverall} · Speed→Strength→IQ→Speed matchups + variance drove the outcome.
          </div>
        </section>
      )}
    </div>
  );
}

function TeamStatCard({ label, score, stats, accent }: { label: string; score: number; stats: TeamStats; accent: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">{label}</div>
      <div className={`font-display text-4xl tabular-nums ${accent}`}>{score}</div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <StatRow k="TDs" v={stats.tds} />
        <StatRow k="FGs" v={stats.fgs} />
        <StatRow k="Punts" v={stats.punts} />
        <StatRow k="Turnovers" v={stats.turnovers} />
        {stats.bigPlays > 0 && <StatRow k="Big plays" v={stats.bigPlays} />}
      </dl>
      {(stats.topScorer && (stats.topScorer.tds + stats.topScorer.fgs) > 0) && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          <span className="text-primary">MVP</span> · {stats.topScorer.name} ({stats.topScorer.position}) — {stats.topScorer.tds} TD / {stats.topScorer.fgs} FG
        </div>
      )}
      {(stats.topDefender && (stats.topDefender.ints + stats.topDefender.stops) > 0) && (
        <div className="text-[11px] text-muted-foreground">
          <span className="text-primary">Defender</span> · {stats.topDefender.name} ({stats.topDefender.position}) — {stats.topDefender.stops} stops / {stats.topDefender.ints} INT
        </div>
      )}
    </div>
  );
}

function StatRow({ k, v }: { k: string; v: number }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right tabular-nums">{v}</dd>
    </>
  );
}

function PlayerStatTable({ title, rows }: { title: string; rows: PlayerStat[] }) {
  const active = rows.filter((r) => r.touches + r.stops + r.ints > 0);
  if (!active.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">{title}</div>
      <table className="mt-2 w-full text-xs">
        <thead className="text-[10px] uppercase text-muted-foreground">
          <tr>
            <th className="text-left font-normal">Player</th>
            <th className="text-right font-normal">TD</th>
            <th className="text-right font-normal">FG</th>
            <th className="text-right font-normal">Stop</th>
            <th className="text-right font-normal">INT</th>
          </tr>
        </thead>
        <tbody>
          {active.map((r) => (
            <tr key={r.id} className="border-t border-border/40">
              <td className="py-1 pr-1 truncate">{r.name} <span className="text-muted-foreground">{r.position}</span></td>
              <td className="text-right tabular-nums">{r.tds}</td>
              <td className="text-right tabular-nums">{r.fgs}</td>
              <td className="text-right tabular-nums">{r.stops}</td>
              <td className="text-right tabular-nums">{r.ints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
