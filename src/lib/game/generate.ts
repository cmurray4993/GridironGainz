import { POSITIONS, RARITY_META, computeFanValue, type Player, type Position, type Rarity } from "./types";

const CANONICAL_NAMES: Record<Rarity, Record<Position, string>> = {
  bronze: {
    QB: 'Buck "Strong Arm" McGee',
    RB: 'Tank "Downhill" Briggs',
    WR: 'Deacon "Sure Hands" Reyes',
    OL: 'Big Moe "The Wall" Kowalski',
    DL: 'Rocco "Trench Beast" Malone',
    LB: 'Chip "Middle Man" Doyle',
    DB: 'Ace "Sticky" Fontaine',
    K:  'Boots "Doink" Sanderson',
  },
  silver: {
    QB: 'Rex "Gunslinger" Callahan',
    RB: 'Duke "Chain Mover" Ramsey',
    WR: 'Flash "Slot Machine" Ortega',
    OL: 'Hoss "Anchor" Van Zandt',
    DL: 'Bull "Sack Man" Okafor',
    LB: 'Ryder "Sideline" Kingsley',
    DB: 'Neo "Ball Hawk" Vega',
    K:  'Splits "Ice Water" Barrett',
  },
  gold: {
    QB: 'Unsigned "Prospect" QB',
    RB: 'Unsigned "Prospect" RB',
    WR: 'Unsigned "Prospect" WR',
    OL: 'Unsigned "Prospect" OL',
    DL: 'Unsigned "Prospect" DL',
    LB: 'Unsigned "Prospect" LB',
    DB: 'Unsigned "Prospect" DB',
    K:  'Unsigned "Prospect" K',
  },
  elite: {
    QB: 'Unsigned "Prospect" QB',
    RB: 'Unsigned "Prospect" RB',
    WR: 'Unsigned "Prospect" WR',
    OL: 'Unsigned "Prospect" OL',
    DL: 'Unsigned "Prospect" DL',
    LB: 'Unsigned "Prospect" LB',
    DB: 'Unsigned "Prospect" DB',
    K:  'Unsigned "Prospect" K',
  },
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
  const meta = RARITY_META[rarity];
  const position = forcedPosition ?? rand(POSITIONS);
  const overall = randInt(meta.overallMin, meta.overallMax);

  // Distribute stats around overall with variance
  const base = overall;
  const jitter = () => randInt(-8, 8);
  const strength = clamp(base + jitter());
  const speed = clamp(base + jitter());
  const iq = clamp(base + jitter());

  const popularity = clamp(
    Math.round(overall * 0.6 + randInt(meta.fanMin, meta.fanMax) * 0.3 + randInt(-8, 12)),
    30,
    99,
  );
  const fanValue = computeFanValue(overall, popularity);

  return {
    id: crypto.randomUUID(),
    name: canonicalName(rarity, position),
    position,
    overall,
    strength,
    speed,
    iq,
    popularity,
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

function buildPlayerWithRarity(rarity: Rarity): Player {
  const meta = RARITY_META[rarity];
  const position = rand(POSITIONS);
  const overall = randInt(meta.overallMin, meta.overallMax);
  const jitter = () => randInt(-8, 8);
  const strength = clamp(overall + jitter());
  const speed = clamp(overall + jitter());
  const iq = clamp(overall + jitter());
  const popularity = clamp(
    Math.round(overall * 0.6 + randInt(meta.fanMin, meta.fanMax) * 0.3 + randInt(-8, 12)),
    30,
    99,
  );
  return {
    id: crypto.randomUUID(),
    name: canonicalName(rarity, position),
    position,
    overall,
    strength,
    speed,
    iq,
    popularity,
    fanValue: computeFanValue(overall, popularity),
    rarity,
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
