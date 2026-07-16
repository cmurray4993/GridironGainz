import { generatePlayer } from "./generate";
import { LINEUP_SLOTS, POSITION_WEIGHTS, type Player, type Position } from "./types";

export interface SimResult {
  homeScore: number;
  awayScore: number;
  win: boolean;
  log: string[];
  opponentOverall: number;
  homeOverall: number;
  opponentName: string;
}

const OPPONENT_NAMES = [
  "Ironside Ravens","Midnight Mavericks","Rust Belt Rollers","Cobalt Coyotes",
  "Neon Nomads","Blackwood Bulls","Ember City Elite","Static Kings",
  "Harbor Hounds","Prairie Wolves",
];

export function pickTodaysOpponent(overall: number) {
  // Deterministic per day
  const seed = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const name = OPPONENT_NAMES[Math.abs(h) % OPPONENT_NAMES.length];
  const delta = ((Math.abs(h) % 30) - 15); // -15..+14
  const opponentOverall = clamp(overall + delta, 55, 95);
  return { name, overall: opponentOverall };
}

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

// Rock-paper-scissors: speed > strength > iq > speed
function rpsBonus(attacker: Player, defender: Player): number {
  const dominant = topStat(attacker);
  const weak = topStat(defender);
  const wins: Record<string, string> = { speed: "strength", strength: "iq", iq: "speed" };
  if (wins[dominant] === weak) return 1.15;
  if (wins[weak] === dominant) return 0.87;
  return 1.0;
}

function topStat(p: Player): "strength" | "speed" | "iq" {
  const w = POSITION_WEIGHTS[p.position];
  const arr: Array<[keyof typeof w, number]> = [
    ["str", p.strength * w.str],
    ["spd", p.speed * w.spd],
    ["iq",  p.iq * w.iq],
  ];
  arr.sort((a, b) => b[1] - a[1]);
  const key = arr[0][0];
  return key === "str" ? "strength" : key === "spd" ? "speed" : "iq";
}

function playerRating(p: Player): number {
  const w = POSITION_WEIGHTS[p.position];
  return p.strength * w.str + p.speed * w.spd + p.iq * w.iq;
}

export function lineupOverall(lineup: (Player | null)[]): number {
  const active = lineup.filter(Boolean) as Player[];
  if (!active.length) return 0;
  return Math.round(active.reduce((s, p) => s + p.overall, 0) / active.length);
}

function synthOpponentLineup(overall: number): Player[] {
  return LINEUP_SLOTS.map((pos) => {
    const p = generatePlayer(pos);
    // rebalance to target overall
    const delta = overall - p.overall;
    return {
      ...p,
      overall: clamp(p.overall + delta, 40, 99),
      strength: clamp(p.strength + delta, 40, 99),
      speed: clamp(p.speed + delta, 40, 99),
      iq: clamp(p.iq + delta, 40, 99),
    };
  });
}

const PLAY_TYPES = [
  "deep pass","screen play","power run","play-action","zone read","QB sneak","fake punt","corner blitz","stunt rush","trick play",
];

export function simulateGame(homeLineup: (Player | null)[], opponentOverall: number, opponentName: string): SimResult {
  const home = homeLineup.filter(Boolean) as Player[];
  const away = synthOpponentLineup(opponentOverall);

  let homeScore = 0;
  let awayScore = 0;
  const log: string[] = [];

  const quarters = 4;
  const drivesPerQuarter = 2;

  for (let q = 1; q <= quarters; q++) {
    log.push(`— Q${q} —`);
    for (let d = 0; d < drivesPerQuarter; d++) {
      const homeDrive = driveResult(home, away, "home");
      homeScore += homeDrive.points;
      log.push(`${playTag()} ${homeDrive.narration} (${homeScore}-${awayScore})`);

      const awayDrive = driveResult(away, home, "away", opponentName);
      awayScore += awayDrive.points;
      log.push(`${playTag()} ${awayDrive.narration} (${homeScore}-${awayScore})`);
    }
  }

  // Coin flip upset chance for close games
  if (Math.abs(homeScore - awayScore) <= 3 && Math.random() < 0.15) {
    const swing = Math.random() < 0.5 ? 3 : 7;
    if (Math.random() < 0.5) { homeScore += swing; log.push(`⚡ Late fourth-and-fortune conversion! +${swing} home.`); }
    else { awayScore += swing; log.push(`⚡ ${opponentName} strike back in the closing seconds! +${swing}.`); }
  }

  const win = homeScore > awayScore;
  log.push(win ? `🏆 Final: Your squad ${homeScore} - ${awayScore} ${opponentName}` : `💔 Final: ${opponentName} ${awayScore} - ${homeScore} Your squad`);

  return {
    homeScore, awayScore, win, log,
    opponentOverall,
    opponentName,
    homeOverall: lineupOverall(homeLineup),
  };
}

function playTag() {
  return `▸`;
}

function driveResult(offense: Player[], defense: Player[], side: "home" | "away", awayName?: string) {
  if (!offense.length) return { points: 0, narration: "No players available — turnover on downs." };

  const off = offense[Math.floor(Math.random() * offense.length)];
  const def = defense[Math.floor(Math.random() * defense.length)];
  const play = PLAY_TYPES[Math.floor(Math.random() * PLAY_TYPES.length)];

  const offRating = playerRating(off) * rpsBonus(off, def);
  const defRating = playerRating(def);

  // Underdog upset factor — noise scales with rating gap so weaker teams can win
  const gap = offRating - defRating;
  const noise = (Math.random() - 0.5) * 40; // big variance = upset potential
  const outcome = gap + noise;

  const who = side === "home" ? off.name : `${awayName ?? "Away"}'s ${off.name}`;

  if (outcome > 18) return { points: 7, narration: `${who} breaks the ${play} for a TOUCHDOWN.` };
  if (outcome > 8)  return { points: 3, narration: `${who} grinds out the ${play}; drive stalls, field goal is good.` };
  if (outcome > -6) return { points: 0, narration: `${who} runs the ${play} but ${def.name} stuffs it. Punt.` };
  if (outcome > -18) return { points: 0, narration: `${def.name} reads the ${play} and forces a three-and-out.` };
  return { points: 0, narration: `${def.name} jumps the ${play} — INTERCEPTION!` };
}
