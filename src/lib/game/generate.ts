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

function buildPlayerWithRarity(rarity: Rarity, forcedPosition?: Position): Player {
  const meta = RARITY_META[rarity];
  const position = forcedPosition ?? rand(POSITIONS);
  let overall = randInt(meta.overallMin, meta.overallMax);
  const jitter = () => randInt(-8, 8);
  let strength = clamp(overall + jitter());
  let speed = clamp(overall + jitter());
  let iq = clamp(overall + jitter());
  let name = canonicalName(rarity, position);

  // Signature gold prospects with tuned stats
  if (rarity === "gold") {
    if (position === "WR") {
      // WR gold pool: Busta or Creighton (TE-flavored WR)
      if (Math.random() < 0.5) {
        name = 'Busta "Fly" Jones';
        speed = clamp(overall + randInt(8, 13));
        iq = clamp(overall - randInt(10, 16));
        strength = clamp(overall + randInt(-4, 4));
      } else {
        name = 'Creighton Murray';
        strength = clamp(overall + randInt(4, 9));
        iq = clamp(overall + randInt(2, 7));
        speed = clamp(overall + randInt(-3, 3));
      }
    } else if (position === "RB") {
      name = 'Gringo Guth';
      strength = clamp(overall + randInt(4, 9));
      speed = clamp(overall + randInt(2, 7));
      iq = clamp(overall + randInt(-6, 2));
    } else if (position === "DL") {
      name = 'Sleepy Cringle';
      strength = clamp(overall + randInt(6, 11));
      iq = clamp(overall + randInt(-2, 4));
      speed = clamp(overall + randInt(-6, 2));
    } else if (position === "DB") {
      name = 'Talon "7 Iron" Reynolds';
      speed = clamp(overall + randInt(6, 11));
      iq = clamp(overall + randInt(2, 6));
      strength = clamp(overall + randInt(-6, 0));
    } else if (position === "LB") {
      name = 'Ty "Teethman" Smith';
      strength = clamp(overall + randInt(5, 10));
      speed = clamp(overall + randInt(-2, 4));
      iq = clamp(overall + randInt(0, 5));
    }
  }

  // Elite signature: Gary Gainz, the 86 OVR OL
  if (rarity === "elite" && position === "OL") {
    name = 'Gary Gainz';
    overall = 86;
    strength = clamp(86 + randInt(4, 8));
    iq = clamp(86 + randInt(-2, 4));
    speed = clamp(86 - randInt(8, 14));
  }

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

// Backyard Heroes Promo — Program I
// Signature cards live on specific rarity+position rolls. Force those
// rolls to guarantee the pull lands on a signature name.
type SigSpec = { rarity: Rarity; position: Position };
const BACKYARD_HERO_SIGS: SigSpec[] = [
  { rarity: "gold", position: "WR" }, // Busta "Fly" Jones OR Creighton Murray
  { rarity: "gold", position: "RB" }, // Gringo Guth
  { rarity: "gold", position: "DL" }, // Sleepy Cringle
  { rarity: "gold", position: "DB" }, // Talon "7 Iron" Reynolds
  { rarity: "gold", position: "LB" }, // Ty "Teethman" Smith
  { rarity: "elite", position: "OL" }, // Gary Gainz (86 OVR)
];

function generateSignaturePromo(): Player {
  const spec = rand(BACKYARD_HERO_SIGS);
  return buildPlayerWithRarity(spec.rarity, spec.position);
}

export function generateBackyardHeroPack(): Player[] {
  // 5 cards. Guarantees 1 signature promo. 40% chance for a second signature.
  // Filler cards are Silver+ so the pack feels premium.
  const players: Player[] = [generateSignaturePromo()];
  if (Math.random() < 0.4) players.push(generateSignaturePromo());
  while (players.length < 5) players.push(generatePlayerAtLeast("silver"));
  // Shuffle so the signature isn't always first.
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }
  return players;
}

