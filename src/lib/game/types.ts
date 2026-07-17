export type Rarity = "bronze" | "silver" | "gold" | "elite";

export type Position = "QB" | "RB" | "WR" | "OL" | "DL" | "LB" | "DB" | "K";

export const POSITIONS: Position[] = ["QB", "RB", "WR", "OL", "DL", "LB", "DB", "K"];

export const LINEUP_SLOTS: Position[] = ["QB", "RB", "WR", "OL", "DL", "LB", "DB"];

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
}

export function computeFanValue(overall: number, popularity: number): number {
  return Math.round(overall * 0.75 + popularity * 0.25);
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
  fans: number;
  roster: Player[];
  lineup: Record<Position, string | null>;
  lastTick: number;
  packsOpened: number;
  wins: number;
  losses: number;
  starterPackOpened?: boolean;
  userId?: string | null;
}

// How much each position leans on strength / speed / iq (weights sum ~1)
export const POSITION_WEIGHTS: Record<Position, { str: number; spd: number; iq: number }> = {
  QB: { str: 0.15, spd: 0.20, iq: 0.65 },
  RB: { str: 0.40, spd: 0.45, iq: 0.15 },
  WR: { str: 0.15, spd: 0.60, iq: 0.25 },
  OL: { str: 0.65, spd: 0.10, iq: 0.25 },
  DL: { str: 0.60, spd: 0.25, iq: 0.15 },
  LB: { str: 0.40, spd: 0.30, iq: 0.30 },
  DB: { str: 0.15, spd: 0.55, iq: 0.30 },
  K:  { str: 0.20, spd: 0.20, iq: 0.60 },
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
export const PACK_COST = 250;
export const PACK_SIZE = 5;
export const PRO_PACK_COST = 7500;
export const PRO_PACK_SIZE = 5;
export const BACKYARD_HERO_PACK_COST = 25000;
export const BACKYARD_HERO_PACK_SIZE = 5;
