// Season model: 7-day regular season + Opening Round, Semifinals,
// and Championship = 10 days per season.
import type { OfficialGameResult } from "./types";

export const REG_DAYS = 7;
export const PLAYOFF_DAYS = 3;
export const SEASON_DAYS = REG_DAYS + PLAYOFF_DAYS; // 10

export type LeagueTier =
  | "backyard"
  | "highschool"
  | "college"
  | "pro"
  | "halloffame";

export const LEAGUE_ORDER: LeagueTier[] = [
  "backyard",
  "highschool",
  "college",
  "pro",
  "halloffame",
];

export interface LeagueMeta {
  tier: LeagueTier;
  name: string;
  short: string;
  emoji: string;
  color: string; // token-friendly hex tint
  regularWin: number;
  fanBonus: number;
}

export const LEAGUES: Record<LeagueTier, LeagueMeta> = {
  backyard:   { tier: "backyard",   name: "Backyard Football",  short: "BYF", emoji: "🥏", color: "#7dd3a0", regularWin: 60,  fanBonus: 10 },
  highschool: { tier: "highschool", name: "High School Gridiron", short: "HSG", emoji: "🏟️", color: "#60a5fa", regularWin: 120, fanBonus: 25 },
  college:    { tier: "college",    name: "College Football",   short: "CFB", emoji: "🎓", color: "#f59e0b", regularWin: 220, fanBonus: 60 },
  pro:        { tier: "pro",        name: "Pro League",         short: "PRO", emoji: "🏈", color: "#ef4444", regularWin: 450, fanBonus: 140 },
  halloffame: { tier: "halloffame", name: "Hall of Fame",       short: "HOF", emoji: "👑", color: "#facc15", regularWin: 900, fanBonus: 320 },
};

// Promotion / relegation — top 4 up, bottom 4 down.
export const TEAMS_PER_LEAGUE = 12;
export const PLAYOFF_TEAMS = 8;
export const PROMOTE_COUNT = 4;
export const RELEGATE_COUNT = 4;

// End-of-season SOL prize pool distributed across every seat in every league.
// Higher tier + higher finish = larger share. Champion of HOF gets the top slice,
// last place of Backyard gets the smallest. Percentages sum to 100 across all 60 seats.
export const TOTAL_SEASON_POT_SOL = 250;

const LEAGUE_WEIGHT: Record<LeagueTier, number> = {
  backyard: 1, highschool: 2, college: 4, pro: 8, halloffame: 16,
};
function positionWeight(pos: number): number {
  // pos 1..12 → weight 12..1
  return TEAMS_PER_LEAGUE + 1 - pos;
}
const TOTAL_WEIGHT = (() => {
  let s = 0;
  for (const t of LEAGUE_ORDER) for (let p = 1; p <= TEAMS_PER_LEAGUE; p++) s += LEAGUE_WEIGHT[t] * positionWeight(p);
  return s;
})();

export function solPrizeFor(tier: LeagueTier, position: number, totalPool = TOTAL_SEASON_POT_SOL): { pct: number; sol: number } {
  const w = LEAGUE_WEIGHT[tier] * positionWeight(position);
  const pct = (w / TOTAL_WEIGHT) * 100;
  const sol = (w / TOTAL_WEIGHT) * totalPool;
  return { pct, sol };
}

export function formatSol(sol: number): string {
  if (sol >= 10) return sol.toFixed(2);
  if (sol >= 1) return sol.toFixed(3);
  return sol.toFixed(4);
}

// Anchor: use a stable UTC date so day numbers are deterministic across clients.
// Season 1 Day 1 begins on 2026-07-13 (Monday). Adjust freely — mock only.
const SEASON_ANCHOR_UTC = Date.UTC(2026, 6, 13);
const DAY_MS = 24 * 60 * 60 * 1000;

export function seasonInfo(now: Date = new Date()) {
  const daysSince = Math.floor((now.getTime() - SEASON_ANCHOR_UTC) / DAY_MS);
  const seasonNumber = Math.floor(daysSince / SEASON_DAYS) + 1;
  const dayOfSeason = (daysSince % SEASON_DAYS) + 1; // 1..20
  const isPlayoffs = dayOfSeason > REG_DAYS;
  const playoffRound = isPlayoffs ? dayOfSeason - REG_DAYS : 0; // 1..3
  const regularDay = isPlayoffs ? REG_DAYS : dayOfSeason;
  const daysUntilPlayoffs = Math.max(0, REG_DAYS + 1 - dayOfSeason);
  const nextSeasonAt = SEASON_ANCHOR_UTC + seasonNumber * SEASON_DAYS * DAY_MS;

  return {
    seasonNumber,
    dayOfSeason,
    regularDay,
    isPlayoffs,
    playoffRound,
    daysUntilPlayoffs,
    playoffsStartAt: SEASON_ANCHOR_UTC + ((seasonNumber - 1) * SEASON_DAYS + REG_DAYS) * DAY_MS,
    championshipAt: SEASON_ANCHOR_UTC + ((seasonNumber - 1) * SEASON_DAYS + SEASON_DAYS - 1) * DAY_MS,
    nextSeasonAt,
  };
}

export const PLAYOFF_ROUND_NAMES = ["Opening Round", "Semifinals", "Championship"] as const;

// ---------- Deterministic mock standings ----------
// Seeded RNG so every viewer sees the same league across the same day.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry(seed: number) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OPPONENT_NAMES = [
  "Iron Bison", "Neon Falcons", "River Wolves", "Steel Comets",
  "Gulf Marauders", "Desert Vipers", "Golden Stags", "Crimson Aces",
  "Blackout Kings", "Shore Sharks", "Skyline Owls", "Prairie Rangers",
  "Volt Titans", "Rustbelt Rams", "Ember Coyotes", "Frost Giants",
];

export interface StandingRow {
  id: string;
  name: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  isYou?: boolean;
}

export interface BracketMatch {
  id: string;
  round: 1 | 2 | 3;
  home: StandingRow;
  away: StandingRow;
  winner?: StandingRow;
  score?: string;
}

export interface PlayoffBracket {
  seeds: StandingRow[];
  rounds: [BracketMatch[], BracketMatch[], BracketMatch[]];
  userQualified: boolean;
  userEliminated: boolean;
  champion?: StandingRow;
}

function cpuWinner(a: StandingRow, b: StandingRow, seasonNumber: number, round: number, game: number): StandingRow {
  const rng = mulberry(hashStr(`bracket:${seasonNumber}:${round}:${game}:${a.id}:${b.id}`));
  const aStrength = 0.5 + (a.wins - b.wins) * 0.045 + ((a.pointsFor - a.pointsAgainst) - (b.pointsFor - b.pointsAgainst)) * 0.0015;
  return rng() < Math.max(0.25, Math.min(0.75, aStrength)) ? a : b;
}

export function generatePlayoffBracket(
  standings: StandingRow[],
  officialResults: OfficialGameResult[],
  seasonNumber: number,
  currentDay: number,
): PlayoffBracket {
  const seeds = standings.slice(0, PLAYOFF_TEAMS);
  const seasonResults = officialResults.filter((r) => r.seasonNumber === seasonNumber);
  const pairs: Array<[number, number]> = [[0, 7], [1, 6], [2, 5], [3, 4]];

  const resolve = (home: StandingRow, away: StandingRow, round: 1 | 2 | 3, game: number): BracketMatch => {
    const targetDay = REG_DAYS + round;
    const includesYou = Boolean(home.isYou || away.isYou);
    const userResult = includesYou ? seasonResults.find((r) => r.dayOfSeason === targetDay) : undefined;
    let winner: StandingRow | undefined;
    let score: string | undefined;
    if (userResult) {
      const you = home.isYou ? home : away;
      const opponent = home.isYou ? away : home;
      winner = userResult.win ? you : opponent;
      score = home.isYou
        ? `${userResult.pointsFor}–${userResult.pointsAgainst}`
        : `${userResult.pointsAgainst}–${userResult.pointsFor}`;
    } else if (!includesYou && currentDay >= targetDay) {
      winner = cpuWinner(home, away, seasonNumber, round, game);
      const loser = winner.id === home.id ? away : home;
      const base = 17 + (hashStr(`${seasonNumber}:${round}:${game}`) % 18);
      const loserScore = Math.max(3, base - 7 - (Math.abs(winner.wins - loser.wins) * 2));
      score = winner.id === home.id ? `${base}–${loserScore}` : `${loserScore}–${base}`;
    }
    return { id: `r${round}g${game}`, round, home, away, winner, score };
  };

  const opening = pairs.map(([a, b], i) => resolve(seeds[a], seeds[b], 1, i));
  const openingWinners = opening.map((m) => m.winner).filter(Boolean) as StandingRow[];
  const semifinals: BracketMatch[] = openingWinners.length === 4
    ? [resolve(openingWinners[0], openingWinners[3], 2, 0), resolve(openingWinners[1], openingWinners[2], 2, 1)]
    : [];
  const semifinalWinners = semifinals.map((m) => m.winner).filter(Boolean) as StandingRow[];
  const championship: BracketMatch[] = semifinalWinners.length === 2
    ? [resolve(semifinalWinners[0], semifinalWinners[1], 3, 0)]
    : [];
  const allResolved = [...opening, ...semifinals, ...championship].filter((m) => m.winner);
  const userQualified = seeds.some((s) => s.isYou);
  const userEliminated = userQualified && allResolved.some((m) => (m.home.isYou || m.away.isYou) && !m.winner?.isYou);
  return { seeds, rounds: [opening, semifinals, championship], userQualified, userEliminated, champion: championship[0]?.winner };
}

export function generateStandings(opts: {
  tier: LeagueTier;
  seasonNumber: number;
  regularDay: number; // 1..7 games played so far in reg season
  you?: { wins: number; losses: number; pointsFor?: number; pointsAgainst?: number; name?: string };
}): StandingRow[] {
  const { tier, seasonNumber, regularDay, you } = opts;
  const rng = mulberry(hashStr(`${tier}:${seasonNumber}`));
  const games = Math.min(REG_DAYS, regularDay);

  const pool = [...OPPONENT_NAMES].sort(() => rng() - 0.5).slice(0, TEAMS_PER_LEAGUE - 1);
  const rows: StandingRow[] = pool.map((name, i) => {
    // Each team gets a "strength" that biases win rate.
    const strength = 0.35 + rng() * 0.5;
    let wins = 0;
    for (let g = 0; g < games; g++) if (rng() < strength) wins++;
    const losses = games - wins;
    const pf = games * (14 + Math.floor(rng() * 18));
    const pa = games * (14 + Math.floor(rng() * 18));
    return { id: `${tier}-${i}`, name, wins, losses, pointsFor: pf, pointsAgainst: pa };
  });

  if (you) {
    const yWins = Math.min(games, you.wins);
    const yLoss = Math.max(0, games - yWins);
    rows.push({
      id: "you",
      name: you.name ?? "Your Squad",
      wins: yWins,
      losses: yLoss,
      pointsFor: you.pointsFor ?? (yWins * 24 + yLoss * 14),
      pointsAgainst: you.pointsAgainst ?? (yLoss * 24 + yWins * 14),
      isYou: true,
    });
  }
  rows.sort((a, b) => b.wins - a.wins || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst));
  return rows;
}

export function formatCountdownDays(ms: number): string {
  if (ms <= 0) return "00d 00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(d).padStart(2, "0")}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
