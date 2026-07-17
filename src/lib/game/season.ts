// Season model: 16-day regular season + 4-day playoffs (Wildcard, Quarterfinal,
// Semifinal, Super Bowl) = 20 days per season. One "week" = one real day.

export const REG_DAYS = 16;
export const PLAYOFF_DAYS = 4;
export const SEASON_DAYS = REG_DAYS + PLAYOFF_DAYS; // 20

export type LeagueTier =
  | "backyard"
  | "highschool"
  | "college"
  | "nfl"
  | "halloffame";

export const LEAGUE_ORDER: LeagueTier[] = [
  "backyard",
  "highschool",
  "college",
  "nfl",
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
  nfl:        { tier: "nfl",        name: "NFL",                short: "NFL", emoji: "🏈", color: "#ef4444", regularWin: 450, fanBonus: 140 },
  halloffame: { tier: "halloffame", name: "Hall of Fame",       short: "HOF", emoji: "👑", color: "#facc15", regularWin: 900, fanBonus: 320 },
};

// Promotion / relegation — top 4 up, bottom 4 down.
export const TEAMS_PER_LEAGUE = 12;
export const PROMOTE_COUNT = 4;
export const RELEGATE_COUNT = 4;

// End-of-season SOL prize pool distributed across every seat in every league.
// Higher tier + higher finish = larger share. Champion of HOF gets the top slice,
// last place of Backyard gets the smallest. Percentages sum to 100 across all 60 seats.
export const TOTAL_SEASON_POT_SOL = 250;

const LEAGUE_WEIGHT: Record<LeagueTier, number> = {
  backyard: 1, highschool: 2, college: 4, nfl: 8, halloffame: 16,
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

export function solPrizeFor(tier: LeagueTier, position: number): { pct: number; sol: number } {
  const w = LEAGUE_WEIGHT[tier] * positionWeight(position);
  const pct = (w / TOTAL_WEIGHT) * 100;
  const sol = (w / TOTAL_WEIGHT) * TOTAL_SEASON_POT_SOL;
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
  const playoffRound = isPlayoffs ? dayOfSeason - REG_DAYS : 0; // 1..4
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
    superBowlAt:    SEASON_ANCHOR_UTC + ((seasonNumber - 1) * SEASON_DAYS + SEASON_DAYS - 1) * DAY_MS,
    nextSeasonAt,
  };
}

export const PLAYOFF_ROUND_NAMES = ["Wild Card", "Quarterfinal", "Semifinal", "Super Bowl"] as const;

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

export function generateStandings(opts: {
  tier: LeagueTier;
  seasonNumber: number;
  regularDay: number; // 1..16 games played so far in reg season
  you?: { wins: number; losses: number; name?: string };
}): StandingRow[] {
  const { tier, seasonNumber, regularDay, you } = opts;
  const rng = mulberry(hashStr(`${tier}:${seasonNumber}`));
  const games = Math.min(REG_DAYS, regularDay);

  const pool = [...OPPONENT_NAMES].sort(() => rng() - 0.5).slice(0, 11);
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
      pointsFor: yWins * 24 + yLoss * 14,
      pointsAgainst: yLoss * 24 + yWins * 14,
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
