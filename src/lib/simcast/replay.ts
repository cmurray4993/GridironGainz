import {
  POSITION_SIGNATURE,
  rarityFromOverall,
  type Player,
  type Position,
  type Rarity,
} from "@/lib/game/types";
import type {
  SimcastPlay,
  SimcastPlayKind,
  SimcastReplay,
  SimcastSide,
  SimcastTeam,
} from "./types";

const OFFENSE_SLOTS = ["QB", "RB", "FLEX", "WR1", "WR2", "TE", "OL"] as const;
const DEFENSE_SLOTS = ["DL", "LB1", "LB2", "DB1", "DB2", "DB3", "DFLEX"] as const;
const ALL_SLOTS = [...OFFENSE_SLOTS, "K", "P", ...DEFENSE_SLOTS] as const;

const SLOT_POSITION: Record<string, Position> = {
  QB: "QB",
  RB: "RB",
  FLEX: "RB",
  WR1: "WR",
  WR2: "WR",
  TE: "TE",
  OL: "OL",
  K: "K",
  P: "P",
  DL: "DL",
  LB1: "LB",
  LB2: "LB",
  DB1: "DB",
  DB2: "DB",
  DB3: "DB",
  DFLEX: "LB",
};

const FIRST_NAMES = ["Jace", "Malik", "Devon", "Cole", "Andre", "Marcus", "Darius", "Zion"];

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seeded(seed: number) {
  let state = seed || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function clampRating(value: number) {
  return Math.max(55, Math.min(99, Math.round(value)));
}

type SnapshotPlayer = Player & { slot?: string };

function normalizedPlayer<T extends SnapshotPlayer>(player: T): T {
  return {
    ...player,
    overall: Number(player.overall),
    strength: Number(player.strength),
    speed: Number(player.speed),
    iq: Number(player.iq),
    popularity: Number(player.popularity),
    fanValue: Number(player.fanValue),
    signature: {
      ...player.signature,
      value: Number(player.signature?.value ?? player.overall),
    },
  } as T;
}

function makeFallbackPlayer(
  teamName: string,
  slot: string,
  overall: number,
  index: number,
): Player {
  const position = SLOT_POSITION[slot] ?? "DB";
  const adjusted = clampRating(overall + ((index % 3) - 1));
  const signature = POSITION_SIGNATURE[position];
  return {
    id: `simcast-${teamName}-${slot}`,
    name: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${teamName.split(" ")[0]} ${position}`,
    program: "base",
    position,
    overall: adjusted,
    strength: clampRating(adjusted + (["OL", "DL", "LB"].includes(position) ? 4 : -2)),
    speed: clampRating(adjusted + (["WR", "RB", "DB"].includes(position) ? 4 : -1)),
    iq: clampRating(adjusted + (position === "QB" ? 5 : 1)),
    popularity: adjusted,
    fanValue: 0,
    rarity: rarityFromOverall(adjusted),
    signature: {
      key: signature.key,
      label: signature.label,
      value: clampRating(adjusted + 2),
    },
  };
}

function toLineup(
  teamName: string,
  snapshot: SnapshotPlayer[] | null | undefined,
  fallbackPlayers: Player[],
  overall: number,
): Record<string, Player> {
  const normalized = (snapshot ?? []).map(normalizedPlayer);
  const remaining = [...normalized];
  const savedIds = new Set(normalized.map((player) => player.id));
  const fallbackRemaining = fallbackPlayers
    .map(normalizedPlayer)
    .filter((player) => !savedIds.has(player.id));
  const lineup: Record<string, Player> = {};

  for (const [index, slot] of ALL_SLOTS.entries()) {
    const position = SLOT_POSITION[slot];
    const savedSlotIndex = remaining.findIndex((player) => player.slot === slot);
    const exactIndex =
      savedSlotIndex >= 0
        ? savedSlotIndex
        : remaining.findIndex((player) => player.position === position);
    const exact = exactIndex >= 0 ? remaining.splice(exactIndex, 1)[0] : undefined;
    const fallbackIndex = fallbackRemaining.findIndex((player) => player.position === position);
    const fallback =
      fallbackIndex >= 0
        ? fallbackRemaining.splice(fallbackIndex, 1)[0]
        : fallbackRemaining.shift();
    lineup[slot] = exact ?? fallback ?? makeFallbackPlayer(teamName, slot, overall, index);
  }
  return lineup;
}

function scoringParts(score: number): number[] {
  const target = Math.max(0, Math.round(score));
  let best: { parts: number[]; cost: number } | null = null;
  for (let sevens = 0; sevens <= Math.ceil(target / 7); sevens += 1) {
    for (let sixes = 0; sixes <= Math.ceil(target / 6); sixes += 1) {
      for (let threes = 0; threes <= Math.ceil(target / 3); threes += 1) {
        if (sevens * 7 + sixes * 6 + threes * 3 !== target) continue;
        const parts = [
          ...Array.from({ length: sevens }, () => 7),
          ...Array.from({ length: sixes }, () => 6),
          ...Array.from({ length: threes }, () => 3),
        ];
        const cost = parts.length * 3 + sixes * 1.5 + threes * 0.25;
        if (!best || cost < best.cost) best = { parts, cost };
      }
    }
  }
  return best?.parts ?? (target ? [target] : []);
}

function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.min(900, totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function rating(player: Player | undefined, key: "strength" | "speed" | "iq") {
  return Number(player?.[key] ?? player?.overall ?? 70);
}

function makeNonScoringPlay(
  id: string,
  possession: SimcastSide,
  offense: SimcastTeam,
  defense: SimcastTeam,
  random: () => number,
  state: {
    eventIndex: number;
    yardLine: number;
    homeScore: number;
    awayScore: number;
  },
): SimcastPlay {
  const roll = random();
  const kind: SimcastPlayKind =
    roll < 0.32
      ? "run"
      : roll < 0.67
        ? "pass_complete"
        : roll < 0.82
          ? "pass_incomplete"
          : roll < 0.93
            ? "sack"
            : "turnover";
  const actorSlot = kind === "run" ? pick(["RB", "FLEX"], random) : "QB";
  const targetSlot = kind.startsWith("pass")
    ? pick(["WR1", "WR2", "TE", "FLEX"], random)
    : undefined;
  const defenderSlot = pick(["DL", "LB1", "LB2", "DB1", "DB2", "DB3", "DFLEX"], random);
  const actor = offense.lineup[targetSlot ?? actorSlot];
  const defender = defense.lineup[defenderSlot];
  const attribute =
    kind === "run"
      ? "strength"
      : kind === "sack"
        ? "strength"
        : kind === "turnover"
          ? "iq"
          : "speed";
  const offenseValue = rating(actor, attribute);
  const defenseValue = rating(defender, attribute);
  const success = kind === "run" || kind === "pass_complete";
  const yards =
    kind === "run"
      ? 2 + Math.floor(random() * 12)
      : kind === "pass_complete"
        ? 7 + Math.floor(random() * 24)
        : kind === "sack"
          ? -(3 + Math.floor(random() * 7))
          : 0;
  const offenseName = actor?.name ?? "The offense";
  const defenderName = defender?.name ?? "the defense";
  const commentary =
    kind === "run"
      ? `${offenseName} finds a crease for ${yards} yards.`
      : kind === "pass_complete"
        ? `${offense.lineup.QB?.name ?? "The quarterback"} connects with ${offenseName} for ${yards}.`
        : kind === "pass_incomplete"
          ? `${defenderName} closes the window and forces an incompletion.`
          : kind === "sack"
            ? `${defenderName} wins up front for a ${Math.abs(yards)}-yard sack.`
            : `${defenderName} reads the play and forces a turnover.`;
  const quarter = Math.min(4, Math.floor(state.eventIndex / 6) + 1);
  return {
    id,
    quarter,
    clock: formatClock(840 - (state.eventIndex % 6) * 118),
    possession,
    kind,
    down: 1 + (state.eventIndex % 4),
    distance: Math.max(1, 10 - Math.max(0, yards)),
    yardLine: state.yardLine,
    yards,
    points: 0,
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    actorSlot,
    targetSlot,
    defenderSlot,
    headline:
      kind === "run"
        ? `${yards}-yard run`
        : kind === "pass_complete"
          ? `${yards}-yard completion`
          : kind === "pass_incomplete"
            ? "Pass broken up"
            : kind === "sack"
              ? "Quarterback sacked"
              : "Takeaway",
    commentary,
    matchup: {
      label: attribute === "iq" ? "IQ READ" : attribute.toUpperCase(),
      offenseValue,
      defenseValue,
      winner: success ? "offense" : "defense",
    },
  };
}

export function buildSimcastReplay(input: {
  gameId: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  homeOverall: number;
  awayOverall: number;
  homeLineup?: SnapshotPlayer[] | null;
  awayLineup?: SnapshotPlayer[] | null;
  homeFallbackPlayers?: Player[];
  awayFallbackPlayers?: Player[];
}): SimcastReplay {
  const random = seeded(hashSeed(`${input.gameId}:simcast-v1`));
  const home: SimcastTeam = {
    side: "home",
    name: input.homeName,
    fallbackOverall: input.homeOverall,
    lineup: toLineup(
      input.homeName,
      input.homeLineup,
      input.homeFallbackPlayers ?? [],
      input.homeOverall,
    ),
  };
  const away: SimcastTeam = {
    side: "away",
    name: input.awayName,
    fallbackOverall: input.awayOverall,
    lineup: toLineup(
      input.awayName,
      input.awayLineup,
      input.awayFallbackPlayers ?? [],
      input.awayOverall,
    ),
  };
  const scoring = [
    ...scoringParts(input.homeScore).map((points) => ({ side: "home" as const, points })),
    ...scoringParts(input.awayScore).map((points) => ({ side: "away" as const, points })),
  ];
  shuffle(scoring, random);

  const plays: SimcastPlay[] = [];
  let homeScore = 0;
  let awayScore = 0;
  let eventIndex = 0;
  let possession: SimcastSide = random() > 0.5 ? "home" : "away";

  plays.push({
    id: `${input.gameId}-kickoff`,
    quarter: 1,
    clock: "15:00",
    possession,
    kind: "kickoff",
    down: 1,
    distance: 10,
    yardLine: 25,
    yards: 0,
    points: 0,
    homeScore,
    awayScore,
    actorSlot: "K",
    targetSlot: "RB",
    headline: "Opening kickoff",
    commentary: `${possession === "home" ? input.homeName : input.awayName} kicks it away.`,
  });

  for (const scoringEvent of scoring) {
    possession = scoringEvent.side;
    const offense = possession === "home" ? home : away;
    const defense = possession === "home" ? away : home;
    let yardLine = 22 + Math.floor(random() * 18);
    const setupCount = 1 + Math.floor(random() * 3);
    for (let setup = 0; setup < setupCount; setup += 1) {
      eventIndex += 1;
      const play = makeNonScoringPlay(
        `${input.gameId}-play-${eventIndex}`,
        possession,
        offense,
        defense,
        random,
        { eventIndex, yardLine, homeScore, awayScore },
      );
      plays.push(play);
      if (play.kind === "turnover") {
        possession = possession === "home" ? "away" : "home";
        break;
      }
      yardLine = Math.max(5, Math.min(92, yardLine + play.yards));
    }

    possession = scoringEvent.side;
    const scoringOffense = possession === "home" ? home : away;
    const scoringDefense = possession === "home" ? away : home;
    const points = scoringEvent.points;
    if (possession === "home") homeScore += points;
    else awayScore += points;
    eventIndex += 1;
    const touchdown = points >= 6;
    const actorSlot = touchdown ? pick(["RB", "WR1", "WR2", "TE", "FLEX"], random) : "K";
    const defenderSlot = pick(["LB1", "LB2", "DB1", "DB2", "DB3", "DFLEX"], random);
    const actor = scoringOffense.lineup[actorSlot];
    const defender = scoringDefense.lineup[defenderSlot];
    plays.push({
      id: `${input.gameId}-score-${eventIndex}`,
      quarter: Math.min(
        4,
        Math.floor(eventIndex / Math.max(1, Math.ceil(scoring.length / 4) + 2)) + 1,
      ),
      clock: formatClock(760 - ((eventIndex * 83) % 700)),
      possession,
      kind: touchdown ? "touchdown" : "field_goal",
      down: touchdown ? 2 : 4,
      distance: touchdown ? 6 : 4,
      yardLine: touchdown ? 94 : 72 + Math.floor(random() * 14),
      yards: touchdown ? 6 + Math.floor(random() * 18) : 0,
      points,
      homeScore,
      awayScore,
      actorSlot,
      targetSlot: touchdown && actorSlot !== "RB" ? actorSlot : undefined,
      defenderSlot,
      headline: touchdown ? "TOUCHDOWN" : "FIELD GOAL",
      commentary: touchdown
        ? `${actor?.name ?? scoringOffense.name} finishes the drive for ${points} points.`
        : `${actor?.name ?? `${scoringOffense.name} kicker`} splits the uprights.`,
      matchup: touchdown
        ? {
            label: actorSlot === "RB" ? "STRENGTH" : "SPEED",
            offenseValue: rating(actor, actorSlot === "RB" ? "strength" : "speed"),
            defenseValue: rating(defender, actorSlot === "RB" ? "strength" : "speed"),
            winner: "offense",
          }
        : undefined,
    });
  }

  // Space every generated play across one continuous game clock. Individual
  // drive generation is score-first, so assigning time here guarantees the
  // visual replay can never jump backward from Q2 to Q1.
  for (let index = 1; index < plays.length; index += 1) {
    const elapsed = Math.min(3_540, Math.floor((index / Math.max(1, plays.length)) * 3_540));
    const quarter = Math.min(4, Math.floor(elapsed / 900) + 1);
    const remaining = 900 - (elapsed % 900);
    plays[index] = {
      ...plays[index],
      quarter,
      clock: formatClock(remaining),
    };
  }

  plays.push({
    id: `${input.gameId}-final`,
    quarter: 4,
    clock: "0:00",
    possession: input.homeScore >= input.awayScore ? "home" : "away",
    kind: "final",
    down: 0,
    distance: 0,
    yardLine: 50,
    yards: 0,
    points: 0,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    actorSlot: "QB",
    headline: "FINAL",
    commentary: `${input.homeName} ${input.homeScore}, ${input.awayName} ${input.awayScore}.`,
  });

  return {
    version: 1,
    gameId: input.gameId,
    home,
    away,
    plays,
    finalHomeScore: input.homeScore,
    finalAwayScore: input.awayScore,
  };
}

export const SIMCAST_OFFENSE_SLOTS = OFFENSE_SLOTS;
export const SIMCAST_DEFENSE_SLOTS = DEFENSE_SLOTS;
