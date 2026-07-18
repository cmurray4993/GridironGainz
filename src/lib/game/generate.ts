import { POSITION_SIGNATURE, POSITIONS, RARITY_META, computeFanValue, type Player, type PlayerSignatureAttr, type Position, type Rarity } from "./types";

export function makeSignatureAttr(position: Position, overall: number, fixed?: number): PlayerSignatureAttr {
  const meta = POSITION_SIGNATURE[position];
  const jitter = fixed != null ? 0 : Math.floor(Math.random() * 17) - 8;
  const value = Math.max(40, Math.min(99, (fixed ?? overall) + jitter));
  return { key: meta.key, label: meta.label, value };
}


export const BASE_PROSPECT_NAMES: Record<Position, string> = {
  QB: 'Jace "Field General" Mercer',
  RB: 'Malik "Northbound" Knox',
  WR: 'Devon "Afterburner" Price',
  TE: 'Cole "Red Zone" Barrett',
  OL: 'Andre "Iron Gate" Bishop',
  DL: 'Marcus "Groundquake" Voss',
  LB: 'Darius "Heat Check" Cole',
  DB: 'Zion "No Fly" Brooks',
  K:  'Eli "Golden Leg" Ward',
  P:  'Nolan "Hangtime" Hale',
};

const CANONICAL_NAMES: Record<Rarity, Record<Position, string>> = {
  bronze: {
    QB: 'Buck "Strong Arm" McGee',
    RB: 'Tank "Downhill" Briggs',
    WR: 'Deacon "Sure Hands" Reyes',
    TE: 'Moose "Seam Buster" Halstead',
    OL: 'Big Moe "The Wall" Kowalski',
    DL: 'Rocco "Trench Beast" Malone',
    LB: 'Chip "Middle Man" Doyle',
    DB: 'Ace "Sticky" Fontaine',
    K:  'Boots "Doink" Sanderson',
    P:  'Boomer "Sky Ball" Hayes',
  },
  silver: {
    QB: 'Rex "Gunslinger" Callahan',
    RB: 'Duke "Chain Mover" Ramsey',
    WR: 'Flash "Slot Machine" Ortega',
    TE: 'Griff "Red Zone" Beaumont',
    OL: 'Hoss "Anchor" Van Zandt',
    DL: 'Bull "Sack Man" Okafor',
    LB: 'Ryder "Sideline" Kingsley',
    DB: 'Neo "Ball Hawk" Vega',
    K:  'Splits "Ice Water" Barrett',
    P:  'Coffin "Corner" Murphy',
  },
  gold: BASE_PROSPECT_NAMES,
  elite: BASE_PROSPECT_NAMES,
};

export function canonicalName(rarity: Rarity, position: Position): string {
  return CANONICAL_NAMES[rarity][position];
}


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
  return "bronze";
}

export function generatePlayer(forcedPosition?: Position): Player {
  const rarity = rollRarity();
  return buildPlayerWithRarity(rarity, forcedPosition);
}

function clamp(v: number, min = 40, max = 99) {
  return Math.max(min, Math.min(max, v));
}

export function generatePack(size: number): Player[] {
  return Array.from({ length: size }, () => generatePlayer());
}

const RARITY_ORDER: Rarity[] = ["bronze", "silver", "gold", "elite"];

export function generatePlayerAtLeast(minRarity: Rarity): Player {
  const minIdx = RARITY_ORDER.indexOf(minRarity);
  // Reroll rarity using existing weights, but reject anything below min.
  for (let i = 0; i < 40; i++) {
    const r = rollRarity();
    if (RARITY_ORDER.indexOf(r) >= minIdx) {
      return buildPlayerWithRarity(r);
    }
  }
  return buildPlayerWithRarity(minRarity);
}

// Signature player registry — fixed identity, overall, and stats so every
// copy of a signature card is stat-for-stat identical.
interface SignatureSpec {
  name: string;
  rarity: Rarity;
  position: Position;
  overall: number;
  strength: number;
  speed: number;
  iq: number;
  popularity: number;
  /** In the Backyard Heroes promo pool. */
  backyard?: boolean;
}

export const SIGNATURES: SignatureSpec[] = [
  { name: 'Busta "Fly" Jones',        rarity: "gold",  position: "WR", overall: 82, strength: 78, speed: 94, iq: 68, popularity: 88, backyard: true },
  { name: 'Josiah "The Messiah" Ball',rarity: "gold",  position: "WR", overall: 84, strength: 80, speed: 90, iq: 86, popularity: 92, backyard: true },
  { name: 'Creighton Murray',         rarity: "gold",  position: "QB", overall: 83, strength: 82, speed: 74, iq: 90, popularity: 84, backyard: true },
  { name: 'Gringo Guth',              rarity: "gold",  position: "RB", overall: 82, strength: 89, speed: 85, iq: 74, popularity: 82, backyard: true },
  { name: 'Sleepy Cringle',           rarity: "gold",  position: "DL", overall: 82, strength: 92, speed: 74, iq: 82, popularity: 80, backyard: true },
  { name: 'Talon "7 Iron" Reynolds',  rarity: "gold",  position: "DB", overall: 83, strength: 76, speed: 92, iq: 88, popularity: 81, backyard: true },
  { name: 'Ty "Teethman" Smith',      rarity: "gold",  position: "LB", overall: 82, strength: 90, speed: 82, iq: 85, popularity: 80, backyard: true },
  { name: 'Josiah "8 Man" Mettling',  rarity: "gold",  position: "LB", overall: 84, strength: 92, speed: 84, iq: 86, popularity: 83, backyard: true },
  { name: 'Breck "Coach Razor" Guthrie', rarity: "gold", position: "RB", overall: 83, strength: 86, speed: 88, iq: 82, popularity: 85, backyard: true },
  { name: 'Gary Gainz',               rarity: "elite", position: "OL", overall: 86, strength: 94, speed: 74, iq: 88, popularity: 90, backyard: true },

  // Non-backyard signatures — obtainable via regular Gold/Elite rolls.
  { name: 'Mason "Bait Man" Baker',   rarity: "gold",  position: "QB", overall: 83, strength: 76, speed: 78, iq: 92, popularity: 82 },
  { name: 'Carter "Combine" Carter',  rarity: "gold",  position: "OL", overall: 82, strength: 93, speed: 66, iq: 80, popularity: 78 },
  { name: 'Sammy "Wheely" Wheeler',   rarity: "gold",  position: "K",  overall: 83, strength: 70, speed: 78, iq: 92, popularity: 84 },
];

function buildFromSignature(sig: SignatureSpec): Player {
  return {
    id: crypto.randomUUID(),
    name: sig.name,
    position: sig.position,
    overall: sig.overall,
    strength: sig.strength,
    speed: sig.speed,
    iq: sig.iq,
    popularity: sig.popularity,
    fanValue: computeFanValue(sig.overall, sig.popularity, sig.rarity),
    rarity: sig.rarity,
    signature: makeSignatureAttr(sig.position, sig.overall, sig.overall),
  };

}

function buildPlayerWithRarity(rarity: Rarity, forcedPosition?: Position): Player {
  const meta = RARITY_META[rarity];
  const position = forcedPosition ?? rand(POSITIONS);

  // If the (rarity, position) has signature candidates, pick one of them —
  // all copies of a given signature are stat-identical.
  if (rarity === "gold" || rarity === "elite") {
    const candidates = SIGNATURES.filter((s) => s.rarity === rarity && s.position === position);
    if (candidates.length) return buildFromSignature(rand(candidates));
  }

  const overall = randInt(meta.overallMin, meta.overallMax);
  const jitter = () => randInt(-8, 8);
  const strength = clamp(overall + jitter());
  const speed = clamp(overall + jitter());
  const iq = clamp(overall + jitter());
  const name = canonicalName(rarity, position);
  const popularity = clamp(
    Math.round(overall * 0.6 + randInt(meta.fanMin, meta.fanMax) * 0.3 + randInt(-8, 12)),
    30,
    99,
  );
  return {
    id: crypto.randomUUID(),
    name,
    position,
    overall,
    strength,
    speed,
    iq,
    popularity,
    fanValue: computeFanValue(overall, popularity, rarity),
    rarity,
    signature: makeSignatureAttr(position, overall),

  };
}

export function generateProPack(): Player[] {
  // 3 bronze+, 1 silver+, 1 gold+
  return [
    generatePlayerAtLeast("bronze"),
    generatePlayerAtLeast("bronze"),
    generatePlayerAtLeast("bronze"),
    generatePlayerAtLeast("silver"),
    generatePlayerAtLeast("gold"),
  ];
}

/** Position pack: single player at a chosen position. 5% gold, 1% elite. */
export function generatePositionPack(position: Position): Player[] {
  const r = Math.random();
  let rarity: Rarity;
  if (r < 0.01) rarity = "elite";
  else if (r < 0.06) rarity = "gold";
  else if (r < 0.40) rarity = "silver";
  else rarity = "bronze";
  return [buildPlayerWithRarity(rarity, position)];
}

function generateSignaturePromo(): Player {
  return buildFromSignature(rand(SIGNATURES));
}

export function generateBackyardHeroPack(): Player[] {
  // 5 cards: 1 Bronze+, 3 Silver+, 1 Gold+.
  // Each slot has a chance to upgrade into a signature promo pull, as long
  // as the signature's rarity meets that slot's floor. ~25% per slot ≈ 1
  // signature per pack on average, with a real chance at multiples.
  const floors: Rarity[] = ["bronze", "silver", "silver", "gold"];
  const SIG_CHANCE = 0.25;
  const players: Player[] = floors.map((floor) => {
    if (Math.random() < SIG_CHANCE) {
      const minIdx = RARITY_ORDER.indexOf(floor);
      const eligible = SIGNATURES.filter((s) => s.backyard && RARITY_ORDER.indexOf(s.rarity) >= minIdx);
      if (eligible.length) return buildFromSignature(rand(eligible));
    }
    return generatePlayerAtLeast(floor);
  });
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }
  return players;
}
