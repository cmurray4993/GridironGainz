import { generatePlayer } from "./generate";
import { LINEUP_SLOTS, POSITION_WEIGHTS, type Player, type Position } from "./types";

export interface PlayerStat {
  id: string;
  name: string;
  position: Position;
  touches: number;
  tds: number;
  fgs: number;
  stops: number;
  ints: number;
}

export interface TeamStats {
  tds: number;
  fgs: number;
  punts: number;
  turnovers: number;
  bigPlays: number;
  topScorer?: PlayerStat;
  topDefender?: PlayerStat;
}

export interface SimResult {
  homeScore: number;
  awayScore: number;
  win: boolean;
  log: string[];
  opponentOverall: number;
  homeOverall: number;
  opponentName: string;
  homeStats: TeamStats;
  awayStats: TeamStats;
  homePlayers: PlayerStat[];
  awayPlayers: PlayerStat[];
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
  const base = p.strength * w.str + p.speed * w.spd + p.iq * w.iq;
  return base + (p.signature?.value ?? 0) * 0.15;
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

  const homeStatsMap = new Map<string, PlayerStat>();
  const awayStatsMap = new Map<string, PlayerStat>();
  const ensure = (map: Map<string, PlayerStat>, p: Player): PlayerStat => {
    let s = map.get(p.id);
    if (!s) { s = { id: p.id, name: p.name, position: p.position, touches: 0, tds: 0, fgs: 0, stops: 0, ints: 0 }; map.set(p.id, s); }
    return s;
  };

  let homeScore = 0;
  let awayScore = 0;
  const log: string[] = [];
  const homeTeam: TeamStats = { tds: 0, fgs: 0, punts: 0, turnovers: 0, bigPlays: 0 };
  const awayTeam: TeamStats = { tds: 0, fgs: 0, punts: 0, turnovers: 0, bigPlays: 0 };

  const quarters = 4;
  const drivesPerQuarter = 2;

  for (let q = 1; q <= quarters; q++) {
    log.push(`— Q${q} —`);
    for (let d = 0; d < drivesPerQuarter; d++) {
      const hd = driveResult(home, away, "home");
      homeScore += hd.points;
      applyStats(hd, ensure(homeStatsMap, hd.offPlayer), ensure(awayStatsMap, hd.defPlayer), homeTeam);
      log.push(`▸ ${hd.narration} (${homeScore}-${awayScore})`);

      const ad = driveResult(away, home, "away", opponentName);
      awayScore += ad.points;
      applyStats(ad, ensure(awayStatsMap, ad.offPlayer), ensure(homeStatsMap, ad.defPlayer), awayTeam);
      log.push(`▸ ${ad.narration} (${homeScore}-${awayScore})`);
    }
  }

  if (Math.abs(homeScore - awayScore) <= 3 && Math.random() < 0.15) {
    const swing = Math.random() < 0.5 ? 3 : 7;
    if (Math.random() < 0.5) { homeScore += swing; homeTeam.bigPlays++; log.push(`⚡ Late fourth-and-fortune conversion! +${swing} home.`); }
    else { awayScore += swing; awayTeam.bigPlays++; log.push(`⚡ ${opponentName} strike back in the closing seconds! +${swing}.`); }
  }

  const win = homeScore > awayScore;
  log.push(win ? `🏆 Final: Your squad ${homeScore} - ${awayScore} ${opponentName}` : `💔 Final: ${opponentName} ${awayScore} - ${homeScore} Your squad`);

  const homePlayers = [...homeStatsMap.values()];
  const awayPlayers = [...awayStatsMap.values()];
  homeTeam.topScorer = [...homePlayers].sort((a, b) => (b.tds * 7 + b.fgs * 3) - (a.tds * 7 + a.fgs * 3))[0];
  homeTeam.topDefender = [...homePlayers].sort((a, b) => (b.ints * 3 + b.stops) - (a.ints * 3 + a.stops))[0];
  awayTeam.topScorer = [...awayPlayers].sort((a, b) => (b.tds * 7 + b.fgs * 3) - (a.tds * 7 + a.fgs * 3))[0];
  awayTeam.topDefender = [...awayPlayers].sort((a, b) => (b.ints * 3 + b.stops) - (a.ints * 3 + a.stops))[0];

  return {
    homeScore, awayScore, win, log,
    opponentOverall, opponentName,
    homeOverall: lineupOverall(homeLineup),
    homeStats: homeTeam, awayStats: awayTeam,
    homePlayers, awayPlayers,
  };
}

interface DriveOutcome {
  points: number;
  narration: string;
  offPlayer: Player;
  defPlayer: Player;
  kind: "td" | "fg" | "punt" | "stuff" | "int" | "none";
}

function applyStats(d: DriveOutcome, off: PlayerStat, def: PlayerStat, team: TeamStats) {
  off.touches++;
  if (d.kind === "td") { off.tds++; team.tds++; }
  else if (d.kind === "fg") { off.fgs++; team.fgs++; }
  else if (d.kind === "punt") { team.punts++; def.stops++; }
  else if (d.kind === "stuff") { team.punts++; def.stops++; }
  else if (d.kind === "int") { team.turnovers++; def.ints++; }
}

const OFFENSE_POS: Position[] = ["QB", "RB", "WR", "TE", "OL"];
const DEFENSE_POS: Position[] = ["DL", "LB", "DB"];

function pickFrom(pool: Player[], positions: Position[], fallback: Player[]): Player {
  const filtered = pool.filter((p) => positions.includes(p.position));
  const src = filtered.length ? filtered : fallback;
  return src[Math.floor(Math.random() * src.length)];
}

function driveResult(offense: Player[], defense: Player[], side: "home" | "away", awayName?: string): DriveOutcome {
  const off = pickFrom(offense, OFFENSE_POS, offense);
  const def = pickFrom(defense, DEFENSE_POS, defense);
  const play = PLAY_TYPES[Math.floor(Math.random() * PLAY_TYPES.length)];

  const offRating = playerRating(off) * rpsBonus(off, def);
  const defRating = playerRating(def);
  const gap = offRating - defRating;
  const noise = (Math.random() - 0.5) * 40;
  const outcome = gap + noise;

  const who = side === "home" ? off.name : `${awayName ?? "Away"}'s ${off.name}`;

  if (outcome > 18) return { points: 7, narration: `${who} breaks the ${play} for a TOUCHDOWN.`, offPlayer: off, defPlayer: def, kind: "td" };
  if (outcome > 8)  return { points: 3, narration: `${who} grinds out the ${play}; drive stalls, field goal is good.`, offPlayer: off, defPlayer: def, kind: "fg" };
  if (outcome > -6) return { points: 0, narration: `${who} runs the ${play} but ${def.name} stuffs it. Punt.`, offPlayer: off, defPlayer: def, kind: "punt" };
  if (outcome > -18) return { points: 0, narration: `${def.name} reads the ${play} and forces a three-and-out.`, offPlayer: off, defPlayer: def, kind: "stuff" };
  return { points: 0, narration: `${def.name} jumps the ${play} — INTERCEPTION!`, offPlayer: off, defPlayer: def, kind: "int" };
}
