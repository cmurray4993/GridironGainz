import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getPlayerArt, getPlayerRarityColor } from "@/components/PlayerCard";
import { cn } from "@/lib/utils";
import { SIMCAST_DEFENSE_SLOTS, SIMCAST_OFFENSE_SLOTS } from "@/lib/simcast/replay";
import type { SimcastPlay, SimcastReplay, SimcastSide, SimcastTeam } from "@/lib/simcast/types";

type Point = { x: number; y: number };
type Speed = 1 | 2 | 4;

const OFFENSE_Y: Record<string, number> = {
  WR1: 14,
  FLEX: 30,
  OL: 50,
  QB: 50,
  RB: 66,
  TE: 78,
  WR2: 90,
  K: 50,
  P: 50,
};

const DEFENSE_Y: Record<string, number> = {
  DB1: 12,
  DB2: 28,
  LB1: 41,
  DL: 50,
  LB2: 60,
  DFLEX: 72,
  DB3: 89,
};

function direction(side: SimcastSide) {
  return side === "home" ? 1 : -1;
}

function basePosition(slot: string, offense: boolean, side: SimcastSide): Point {
  const dir = direction(side);
  const line = side === "home" ? 38 : 62;
  if (offense) {
    const offsets: Record<string, number> = {
      OL: 0,
      QB: -8,
      RB: -16,
      FLEX: -11,
      WR1: -2,
      WR2: -2,
      TE: -1,
      K: -13,
      P: -9,
    };
    return { x: line + (offsets[slot] ?? -4) * dir, y: OFFENSE_Y[slot] ?? 50 };
  }
  const offsets: Record<string, number> = {
    DL: 5,
    LB1: 12,
    LB2: 12,
    DFLEX: 17,
    DB1: 23,
    DB2: 21,
    DB3: 23,
  };
  return { x: line + (offsets[slot] ?? 12) * dir, y: DEFENSE_Y[slot] ?? 50 };
}

function actionPosition(
  slot: string,
  offense: boolean,
  side: SimcastSide,
  play: SimcastPlay,
  phase: number,
): Point {
  const base = basePosition(slot, offense, side);
  if (phase === 0 || play.kind === "final") return base;
  const dir = direction(play.possession);
  const gain = Math.max(5, Math.min(28, Math.abs(play.yards) * 0.55 + 8));
  const actor = slot === play.actorSlot;
  const target = slot === play.targetSlot;
  const defender = slot === play.defenderSlot;

  if (offense) {
    if (play.kind === "run" && actor) {
      return { x: base.x + gain * dir * (phase === 1 ? 0.5 : 1), y: 55 };
    }
    if (
      (play.kind === "pass_complete" ||
        play.kind === "pass_incomplete" ||
        play.kind === "touchdown") &&
      target
    ) {
      const destination = play.kind === "touchdown" ? (dir === 1 ? 92 : 8) : base.x + gain * dir;
      return {
        x: phase === 1 ? base.x + (destination - base.x) * 0.55 : destination,
        y: base.y + (slot === "TE" ? -8 : slot === "FLEX" ? 8 : 0),
      };
    }
    if (
      (play.kind === "pass_complete" || play.kind === "pass_incomplete" || play.kind === "sack") &&
      slot === "QB"
    ) {
      return { x: base.x - 4 * dir, y: base.y };
    }
    if (play.kind === "field_goal" && slot === "K") {
      const kicker = basePosition("QB", true, side);
      return { x: kicker.x + (phase === 2 ? 5 : 0) * dir, y: 50 };
    }
    if (["WR1", "WR2", "TE", "FLEX"].includes(slot)) {
      return { x: base.x + (phase === 1 ? 7 : 12) * dir, y: base.y };
    }
    return { x: base.x + (phase === 2 ? 3 : 1) * dir, y: base.y };
  }

  if (defender) {
    const offenseTarget =
      play.targetSlot ??
      (play.kind === "run" ? play.actorSlot : play.actorSlot === "QB" ? "QB" : "RB");
    const targetBase = basePosition(offenseTarget, true, play.possession);
    const targetAction = actionPosition(offenseTarget, true, play.possession, play, phase);
    return {
      x: phase === 1 ? targetBase.x + 5 * dir : targetAction.x - 1.5 * dir,
      y: phase === 1 ? targetBase.y : targetAction.y + 2,
    };
  }
  if (slot === "DL" && play.kind === "sack") {
    const quarterback = actionPosition("QB", true, play.possession, play, phase);
    return { x: quarterback.x + 1.5 * dir, y: quarterback.y };
  }
  return { x: base.x - (phase === 2 ? 4 : 2) * dir, y: base.y };
}

function ballPosition(play: SimcastPlay, phase: number): Point | null {
  if (play.kind === "final") return null;
  const side = play.possession;
  const dir = direction(side);
  if (play.kind === "kickoff") {
    return {
      x: phase === 0 ? (dir === 1 ? 18 : 82) : phase === 1 ? 50 : dir === 1 ? 72 : 28,
      y: 50,
    };
  }
  if (play.kind === "field_goal") {
    return {
      x: phase === 0 ? (dir === 1 ? 32 : 68) : phase === 1 ? 50 : dir === 1 ? 96 : 4,
      y: phase === 2 ? 18 : 50,
    };
  }
  const quarterback = actionPosition("QB", true, side, play, phase);
  const ballCarrier = play.targetSlot ?? play.actorSlot;
  const target = actionPosition(ballCarrier, true, side, play, phase);
  if (play.kind === "run") return actionPosition(play.actorSlot, true, side, play, phase);
  if (play.kind === "sack" || play.kind === "turnover") return phase < 2 ? quarterback : target;
  if (play.kind.startsWith("pass") || play.kind === "touchdown") {
    if (phase === 0) return quarterback;
    if (phase === 1) {
      return {
        x: quarterback.x + (target.x - quarterback.x) * 0.55,
        y: quarterback.y + (target.y - quarterback.y) * 0.55,
      };
    }
    return target;
  }
  return { x: 50 + 4 * dir, y: 50 };
}

export function FootballSimCast({ replay }: { replay: SimcastReplay }) {
  const [playIndex, setPlayIndex] = useState(0);
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const play = replay.plays[playIndex] ?? replay.plays[0];
  const atEnd = playIndex >= replay.plays.length - 1;

  useEffect(() => {
    if (!playing || atEnd) return;
    setPhase(0);
    const actionTimer = window.setTimeout(() => setPhase(1), 360 / speed);
    const finishTimer = window.setTimeout(() => setPhase(2), 1_050 / speed);
    const nextTimer = window.setTimeout(() => {
      setPlayIndex((index) => Math.min(replay.plays.length - 1, index + 1));
      setPhase(0);
    }, 2_450 / speed);
    return () => {
      window.clearTimeout(actionTimer);
      window.clearTimeout(finishTimer);
      window.clearTimeout(nextTimer);
    };
  }, [atEnd, playIndex, playing, replay.plays.length, speed]);

  useEffect(() => {
    if (atEnd) setPlaying(false);
  }, [atEnd]);

  const offense = play.possession === "home" ? replay.home : replay.away;
  const defense = play.possession === "home" ? replay.away : replay.home;
  const ball = ballPosition(play, phase);
  const recentPlays = useMemo(
    () =>
      replay.plays.slice(Math.max(0, playIndex - 3), Math.min(replay.plays.length, playIndex + 2)),
    [playIndex, replay.plays],
  );
  const visibleOffenseSlots =
    play.kind === "field_goal"
      ? (["OL", "K", "P", "TE", "WR1", "WR2", "QB"] as const)
      : play.kind === "kickoff"
        ? (["K", "WR1", "WR2", "TE", "OL", "RB", "FLEX"] as const)
        : SIMCAST_OFFENSE_SLOTS;

  const selectPlay = (index: number) => {
    setPlaying(false);
    setPlayIndex(Math.max(0, Math.min(replay.plays.length - 1, index)));
    setPhase(0);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-sky-400/30 bg-[#050b13] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <Scoreboard replay={replay} play={play} />

      <div className="relative aspect-[16/9] min-h-[215px] w-full overflow-hidden bg-[#0b5328] sm:min-h-[330px]">
        <FieldMarkings possession={play.possession} yardLine={play.yardLine} />

        {visibleOffenseSlots.map((slot) => (
          <PlayerToken
            key={`offense-${slot}`}
            slot={slot}
            team={offense}
            offense
            position={actionPosition(slot, true, play.possession, play, phase)}
            active={slot === play.actorSlot || slot === play.targetSlot}
            transitionMs={720 / speed}
          />
        ))}
        {SIMCAST_DEFENSE_SLOTS.map((slot) => (
          <PlayerToken
            key={`defense-${slot}`}
            slot={slot}
            team={defense}
            offense={false}
            position={actionPosition(slot, false, play.possession, play, phase)}
            active={slot === play.defenderSlot}
            transitionMs={720 / speed}
          />
        ))}

        {ball && (
          <div
            aria-label="Football"
            className="absolute z-30 h-2.5 w-4 -translate-x-1/2 -translate-y-1/2 rotate-[-18deg] rounded-[50%] border border-white/70 bg-[#8b4b24] shadow-[0_2px_5px_rgba(0,0,0,.8)] transition-[left,top] ease-in-out sm:h-3 sm:w-5"
            style={{
              left: `${ball.x}%`,
              top: `${ball.y}%`,
              transitionDuration: `${720 / speed}ms`,
            }}
          >
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/80" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-40 flex justify-center px-3">
          <div
            className={cn(
              "max-w-[92%] rounded-lg border px-3 py-1.5 text-center shadow-xl backdrop-blur-md transition",
              play.kind === "touchdown"
                ? "border-amber-300/70 bg-amber-400/90 text-black"
                : play.kind === "turnover"
                  ? "border-red-400/60 bg-red-950/90 text-white"
                  : "border-white/15 bg-black/70 text-white",
            )}
          >
            <div className="font-display text-sm uppercase tracking-wide sm:text-xl">
              {play.headline}
            </div>
            <div className="hidden text-[10px] text-current/75 sm:block">{play.commentary}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-0 border-t border-white/10 bg-[#070e18] lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => selectPlay(0)}
              className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/5 text-white hover:bg-white/10"
              aria-label="Restart replay"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => selectPlay(playIndex - 1)}
              disabled={playIndex === 0}
              className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/5 text-white disabled:opacity-30"
              aria-label="Previous play"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (atEnd) selectPlay(0);
                setPlaying((value) => !value);
              }}
              className="flex h-9 min-w-24 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? "Pause" : atEnd ? "Replay" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => selectPlay(playIndex + 1)}
              disabled={atEnd}
              className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/5 text-white disabled:opacity-30"
              aria-label="Next play"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <div className="ml-auto flex rounded-md border border-white/10 bg-white/5 p-0.5">
              {([1, 2, 4] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setSpeed(value)}
                  className={cn(
                    "rounded px-2.5 py-1.5 text-xs font-semibold",
                    speed === value ? "bg-white text-black" : "text-white/65",
                  )}
                >
                  {value}×
                </button>
              ))}
            </div>
          </div>

          <input
            type="range"
            aria-label="Replay progress"
            min={0}
            max={Math.max(0, replay.plays.length - 1)}
            value={playIndex}
            onChange={(event) => selectPlay(Number(event.target.value))}
            className="mt-4 h-1.5 w-full accent-primary"
          />

          <div className="mt-3 grid grid-cols-3 gap-2">
            <GameDetail label="Possession" value={offense.name} />
            <GameDetail
              label="Situation"
              value={
                play.kind === "final" ? "Game over" : `${ordinal(play.down)} & ${play.distance}`
              }
            />
            <GameDetail label="Ball" value={fieldPosition(play.possession, play.yardLine)} />
          </div>

          {play.matchup && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-sky-400/20 bg-sky-400/5 px-3 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-300">
                {play.matchup.label}
              </div>
              <MatchupMeter
                offense={play.matchup.offenseValue}
                defense={play.matchup.defenseValue}
                winner={play.matchup.winner}
              />
            </div>
          )}
        </div>

        <div className="border-t border-white/10 bg-black/20 p-3 lg:border-l lg:border-t-0">
          <div className="mb-2 text-[9px] uppercase tracking-[0.2em] text-white/45">
            Live play feed
          </div>
          <ol className="space-y-1">
            {recentPlays.map((item) => {
              const index = replay.plays.indexOf(item);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => selectPlay(index)}
                    className={cn(
                      "grid w-full grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left",
                      index === playIndex
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:bg-white/5",
                    )}
                  >
                    <span className="text-[9px] tabular-nums">
                      Q{item.quarter} {item.clock}
                    </span>
                    <span className="truncate text-[11px]">{item.headline}</span>
                    <span className="font-display text-xs tabular-nums">
                      {item.homeScore}-{item.awayScore}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Scoreboard({ replay, play }: { replay: SimcastReplay; play: SimcastPlay }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch border-b border-white/10 bg-[#091321] text-white">
      <TeamScore
        name={replay.home.name}
        score={play.homeScore}
        active={play.possession === "home" && play.kind !== "final"}
        align="left"
      />
      <div className="flex min-w-20 flex-col items-center justify-center border-x border-white/10 px-3 py-2">
        <span className="font-display text-sm text-amber-300">Q{play.quarter}</span>
        <span className="font-display text-xl tabular-nums">{play.clock}</span>
      </div>
      <TeamScore
        name={replay.away.name}
        score={play.awayScore}
        active={play.possession === "away" && play.kind !== "final"}
        align="right"
      />
    </div>
  );
}

function TeamScore({
  name,
  score,
  active,
  align,
}: {
  name: string;
  score: number;
  active: boolean;
  align: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 px-3 py-2 sm:px-5",
        align === "right" && "flex-row-reverse",
      )}
    >
      <div
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          active ? "bg-amber-300 shadow-[0_0_10px_#fbbf24]" : "bg-white/20",
        )}
      />
      <div className={cn("min-w-0 flex-1", align === "right" && "text-right")}>
        <div className="truncate text-[9px] uppercase tracking-wider text-white/55 sm:text-[11px]">
          {name}
        </div>
        <div className="font-display text-2xl leading-none sm:text-3xl">{score}</div>
      </div>
    </div>
  );
}

function PlayerToken({
  slot,
  team,
  offense,
  position,
  active,
  transitionMs,
}: {
  slot: string;
  team: SimcastTeam;
  offense: boolean;
  position: Point;
  active: boolean;
  transitionMs: number;
}) {
  const player = team.lineup[slot];
  if (!player) return null;
  const art = getPlayerArt(player);
  const border = getPlayerRarityColor(player.rarity);
  return (
    <div
      className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-[left,top] ease-in-out"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transitionDuration: `${transitionMs}ms`,
      }}
      title={`${player.name} · ${player.overall} OVR`}
    >
      <div
        className={cn(
          "relative h-7 w-7 overflow-hidden rounded-full border-2 bg-black shadow-[0_3px_8px_rgba(0,0,0,.75)] sm:h-11 sm:w-11",
          active && "scale-110 ring-2 ring-white/85 ring-offset-1 ring-offset-transparent",
        )}
        style={{ borderColor: border }}
      >
        <img src={art} alt="" className="h-full w-full object-cover object-top" />
        <span
          className={cn(
            "absolute inset-x-0 bottom-0 text-center font-display text-[5px] leading-2 text-white sm:text-[7px]",
            offense ? "bg-sky-700/90" : "bg-red-700/90",
          )}
        >
          {player.overall}
        </span>
      </div>
      <div className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-black/75 px-1 font-display text-[5px] leading-3 text-white/90 sm:text-[7px]">
        {slot}
      </div>
    </div>
  );
}

function FieldMarkings({ possession, yardLine }: { possession: SimcastSide; yardLine: number }) {
  const scrimmage = possession === "home" ? yardLine : 100 - yardLine;
  return (
    <>
      <div className="absolute inset-y-0 left-0 w-[7%] border-r-2 border-white/60 bg-[#123c78]">
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 font-display text-[8px] tracking-[0.3em] text-white/70 sm:text-sm">
          HOME
        </span>
      </div>
      <div className="absolute inset-y-0 right-0 w-[7%] border-l-2 border-white/60 bg-[#7c2531]">
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 font-display text-[8px] tracking-[0.3em] text-white/70 sm:text-sm">
          AWAY
        </span>
      </div>
      {Array.from({ length: 11 }, (_, index) => {
        const left = 7 + index * 8.6;
        return (
          <div
            key={index}
            className="absolute inset-y-0 border-l border-white/20"
            style={{ left: `${left}%` }}
          >
            {index > 0 && index < 10 && (
              <>
                <span className="absolute left-1 top-[8%] font-display text-[7px] text-white/35 sm:text-[10px]">
                  {index <= 5 ? index * 10 : (10 - index) * 10}
                </span>
                <span className="absolute bottom-[8%] left-1 rotate-180 font-display text-[7px] text-white/35 sm:text-[10px]">
                  {index <= 5 ? index * 10 : (10 - index) * 10}
                </span>
              </>
            )}
          </div>
        );
      })}
      <div
        className="absolute inset-y-0 z-10 w-0.5 bg-sky-300/90 shadow-[0_0_8px_#38bdf8]"
        style={{ left: `${7 + scrimmage * 0.86}%` }}
      />
      <div className="absolute inset-x-[7%] top-1/2 border-t border-white/15" />
      <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 sm:h-32 sm:w-32" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,.18)_100%)]" />
    </>
  );
}

function GameDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-2 text-center">
      <div className="text-[7px] uppercase tracking-widest text-white/40 sm:text-[9px]">
        {label}
      </div>
      <div className="truncate font-display text-[10px] text-white sm:text-sm">{value}</div>
    </div>
  );
}

function MatchupMeter({
  offense,
  defense,
  winner,
}: {
  offense: number;
  defense: number;
  winner: "offense" | "defense";
}) {
  const total = Math.max(1, offense + defense);
  const offenseWidth = `${(offense / total) * 100}%`;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span
        className={cn(
          "font-display text-xs",
          winner === "offense" ? "text-sky-300" : "text-white/60",
        )}
      >
        {offense}
      </span>
      <div className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="bg-sky-400" style={{ width: offenseWidth }} />
        <div className="flex-1 bg-red-400" />
      </div>
      <span
        className={cn(
          "font-display text-xs",
          winner === "defense" ? "text-red-300" : "text-white/60",
        )}
      >
        {defense}
      </span>
    </div>
  );
}

function ordinal(down: number) {
  if (down === 1) return "1st";
  if (down === 2) return "2nd";
  if (down === 3) return "3rd";
  return "4th";
}

function fieldPosition(possession: SimcastSide, yardLine: number) {
  const territory =
    yardLine > 50 ? (possession === "home" ? "AWY" : "HME") : possession === "home" ? "HME" : "AWY";
  return `${territory} ${yardLine > 50 ? 100 - yardLine : yardLine}`;
}
