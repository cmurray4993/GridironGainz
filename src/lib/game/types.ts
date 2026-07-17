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
  common:    { label: "Common",    weight: 60, overallMin: 55, overallMax: 70, fanMin: 5,   fanMax: 20 },
  uncommon:  { label: "Uncommon",  weight: 25, overallMin: 65, overallMax: 78, fanMin: 15,  fanMax: 45 },
  rare:      { label: "Rare",      weight: 10, overallMin: 74, overallMax: 85, fanMin: 40,  fanMax: 90 },
  epic:      { label: "Epic",      weight: 4,  overallMin: 82, overallMax: 92, fanMin: 80,  fanMax: 180 },
  legendary: { label: "Legendary", weight: 1,  overallMin: 90, overallMax: 99, fanMin: 200, fanMax: 500 },
};

export const COIN_PER_FAN_PER_HOUR = 0.01;
export const PACK_COST = 250;
export const PACK_SIZE = 5;
