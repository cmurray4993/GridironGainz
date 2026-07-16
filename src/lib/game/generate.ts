import { POSITIONS, RARITY_META, type Player, type Position, type Rarity } from "./types";

const FIRST = ["Jax","Cade","Rio","Deshaun","Tariq","Marcus","Kai","Elijah","Zion","Trey","Damon","Rome","Beau","Ace","Nico","Kobe","Silas","Odell","Jaxon","Malik","Deon","Reese","Bryce","Tate","Cash","Onyx","Rex","Blaze","Sterling","Quinton","Amari","Roman","Miles","Kingsley","Titus","Emmitt","Ronan","Dax","Cruz","Wyatt"];
const LAST = ["Steele","Hawke","Vega","Bishop","Cross","Storm","Rivers","Knox","Reign","Cole","Blackwood","Vaughn","Kingsley","Ashford","Lang","Monroe","Holt","Sinclair","Rhodes","Sable","Vance","Kane","Fox","North","Pierce","Wilder","Locke","Sable","Marsh","Beckett","Ellis","Grady","Slater","Thorn","Cavanaugh","Rooks","Duval","Larkin","Whit","Ozuna"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function rollRarity(): Rarity {
  const total = Object.values(RARITY_META).reduce((s, r) => s + r.weight, 0);
  let n = Math.random() * total;
  for (const [key, meta] of Object.entries(RARITY_META)) {
    n -= meta.weight;
    if (n <= 0) return key as Rarity;
  }
  return "common";
}

export function generatePlayer(forcedPosition?: Position): Player {
  const rarity = rollRarity();
  const meta = RARITY_META[rarity];
  const position = forcedPosition ?? rand(POSITIONS);
  const overall = randInt(meta.overallMin, meta.overallMax);

  // Distribute stats around overall with variance
  const base = overall;
  const jitter = () => randInt(-8, 8);
  const strength = clamp(base + jitter());
  const speed = clamp(base + jitter());
  const iq = clamp(base + jitter());

  const fanValue = randInt(meta.fanMin, meta.fanMax);

  return {
    id: crypto.randomUUID(),
    name: `${rand(FIRST)} ${rand(LAST)}`,
    position,
    overall,
    strength,
    speed,
    iq,
    fanValue,
    rarity,
  };
}

function clamp(v: number, min = 40, max = 99) {
  return Math.max(min, Math.min(max, v));
}

export function generatePack(size: number): Player[] {
  return Array.from({ length: size }, () => generatePlayer());
}
