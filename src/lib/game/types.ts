export type Rarity = "bronze" | "silver" | "gold" | "elite";

export type Position = "QB" | "RB" | "WR" | "TE" | "OL" | "DL" | "LB" | "DB" | "K" | "P";

export const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "K", "P"];

// Starting-lineup slot IDs. Positions with multiple starters get numeric
// suffixes (WR1/WR2, LB1/LB2, DB1/DB2/DB3). FLEX accepts RB/WR/TE;
// DFLEX accepts LB/DB.
// Use slotPosition() to recover the base Position used for opponent synth
// and stat weights; use slotAccepts() for the picker allow-list.
export const LINEUP_SLOTS: string[] = [
  // Offense (7)
  "QB", "RB", "FLEX", "WR1", "WR2", "TE", "OL",
  // Special teams
  "K", "P",
  // Defense (7)
  "DL", "LB1", "LB2", "DB1", "DB2", "DB3", "DFLEX",
];

export const FLEX_POSITIONS: Position[] = ["RB", "WR", "TE"];
export const DEFENSIVE_FLEX_POSITIONS: Position[] = ["LB", "DB"];

export function slotPosition(slot: string): Position {
  if (slot === "FLEX") return "RB";
  if (slot === "DFLEX") return "LB";
  return slot.replace(/\d+$/, "") as Position;
}

export function slotAccepts(slot: string): Position[] {
  if (slot === "FLEX") return FLEX_POSITIONS;
  if (slot === "DFLEX") return DEFENSIVE_FLEX_POSITIONS;
  return [slotPosition(slot)];
}

export interface PlayerSignatureAttr {
  key: string;
  label: string;
  value: number;
}

export const POSITION_SIGNATURE: Record<Position, { key: string; label: string }> = {
  QB: { key: "accuracy", label: "Accuracy" },
  RB: { key: "vision", label: "Vision" },
  WR: { key: "routeRunning", label: "Route Running" },
  TE: { key: "blocking", label: "Blocking" },
  OL: { key: "passPro", label: "Pass Protection" },
  DL: { key: "passRush", label: "Pass Rush" },
  LB: { key: "tackling", label: "Tackling" },
  DB: { key: "coverage", label: "Coverage" },
  K:  { key: "legPower", label: "Leg Power" },
  P:  { key: "hangTime", label: "Hang Time" },
};

export interface Player {
  id: string;
  name: string;
  position: Position;
  overall: number;
  strength: number;
  speed: number;
  iq: number;
  popularity: number;
  fanValue: number;
  rarity: Rarity;
  signature: PlayerSignatureAttr;
}


const FAN_RARITY_MULTIPLIER: Record<Rarity, number> = {
  bronze: 1,
  silver: 1.5,
  gold: 3,
  elite: 6,
};

export function computeFanValue(overall: number, popularity: number, rarity: Rarity): number {
  const talent = Math.max(0, overall - 50) ** 2;
  const appeal = 0.5 + popularity / 200;
  return Math.round(talent * appeal * FAN_RARITY_MULTIPLIER[rarity]);
}

export type Archetype = "Speedster" | "Bruiser" | "Genius" | "Balanced";

export function playerArchetype(p: Pick<Player, "strength" | "speed" | "iq">): Archetype {
  const { strength: s, speed: sp, iq: iq } = p;
  const max = Math.max(s, sp, iq);
  const min = Math.min(s, sp, iq);
  if (max - min <= 6) return "Balanced";
  if (max === sp) return "Speedster";
  if (max === s) return "Bruiser";
  return "Genius";
}

export function fansPerHour(p: Player): number {
  return +(p.fanValue * COIN_PER_FAN_PER_HOUR).toFixed(3);
}

export interface GameState {
  coins: number;
  gridironCash?: number;
  currentPrizePoolSol?: number;
  nextSeasonPoolSol?: number;
  devTreasurySol?: number;
  cashPurchases?: CashPurchase[];
  fans: number;
  roster: Player[];
  lineup: Record<string, string | null>;
  lastTick: number;
  packsOpened: number;
  wins: number;
  losses: number;
  pointsFor?: number;
  pointsAgainst?: number;
  officialGameKeys?: string[];
  officialResults?: OfficialGameResult[];
  starterPackOpened?: boolean;
  userId?: string | null;
  teamName?: string;
  sol?: number;
  walletAddress?: string;
}

export interface CashPurchase {
  id: string;
  createdAt: number;
  sol: number;
  cash: number;
  currentPoolSol: number;
  nextPoolSol: number;
  devSol: number;
  signature?: string;
}

export interface OfficialGameResult {
  key: string;
  seasonNumber: number;
  dayOfSeason: number;
  win: boolean;
  pointsFor: number;
  pointsAgainst: number;
  opponentName: string;
}


// How much each position leans on strength / speed / iq (weights sum ~1)
export const POSITION_WEIGHTS: Record<Position, { str: number; spd: number; iq: number }> = {
  QB: { str: 0.15, spd: 0.20, iq: 0.65 },
  RB: { str: 0.40, spd: 0.45, iq: 0.15 },
  WR: { str: 0.15, spd: 0.60, iq: 0.25 },
  TE: { str: 0.40, spd: 0.30, iq: 0.30 },
  OL: { str: 0.65, spd: 0.10, iq: 0.25 },
  DL: { str: 0.60, spd: 0.25, iq: 0.15 },
  LB: { str: 0.40, spd: 0.30, iq: 0.30 },
  DB: { str: 0.15, spd: 0.55, iq: 0.30 },
  K:  { str: 0.20, spd: 0.20, iq: 0.60 },
  P:  { str: 0.25, spd: 0.15, iq: 0.60 },
};

export const RARITY_META: Record<Rarity, { label: string; weight: number; overallMin: number; overallMax: number; fanMin: number; fanMax: number }> = {
  bronze: { label: "Bronze", weight: 60, overallMin: 60, overallMax: 69, fanMin: 5,  fanMax: 25 },
  silver: { label: "Silver", weight: 28, overallMin: 70, overallMax: 79, fanMin: 20, fanMax: 60 },
  gold:   { label: "Gold",   weight: 10, overallMin: 80, overallMax: 84, fanMin: 55, fanMax: 120 },
  elite:  { label: "Elite",  weight: 2,  overallMin: 85, overallMax: 86, fanMin: 100, fanMax: 220 },
};

// Max overall currently obtainable in the game.
export const MAX_OVERALL = 86;

export function rarityFromOverall(overall: number): Rarity {
  if (overall >= 85) return "elite";
  if (overall >= 80) return "gold";
  if (overall >= 70) return "silver";
  return "bronze";
}

export const COIN_PER_FAN_PER_HOUR = 0.01;
export const PACK_COST = 5_000;
export const PACK_SIZE = 5;
export const PRO_PACK_COST = 25_000;
export const PRO_PACK_SIZE = 5;
export const BACKYARD_HERO_PACK_COST = 75_000;
export const BACKYARD_HERO_PACK_SIZE = 5;
export const POSITION_PACK_COST = 15_000;
export const GRIDIRON_CASH_PER_SOL = 10_000;
export const PREMIUM_PACK_CASH_COST = 1_000;
