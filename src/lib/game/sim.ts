import { generatePlayer } from "./generate";
import { LINEUP_SLOTS, POSITION_WEIGHTS, rarityFromOverall, slotPosition, type Player, type Position } from "./types";

export interface PlayerStat { id: string; name: string; position: Position; touches: number; tds: number; fgs: number; stops: number; ints: number }
export interface TeamStats { tds: number; fgs: number; punts: number; turnovers: number; bigPlays: number; topScorer?: PlayerStat; topDefender?: PlayerStat }
export type OffensiveStrategy = "balanced" | "power-run" | "outside-run" | "short-pass" | "deep-pass";
export type DefensiveStrategy = "balanced" | "stop-run" | "press" | "protect-deep" | "blitz";
export interface GamePlan { offense: OffensiveStrategy; defense: DefensiveStrategy }
export interface SimResult {
  homeScore: number; awayScore: number; win: boolean; log: string[]; opponentOverall: number; homeOverall: number;
  opponentName: string; homeStats: TeamStats; awayStats: TeamStats; homePlayers: PlayerStat[]; awayPlayers: PlayerStat[]; insights: string[];
}

export const OFFENSIVE_STRATEGIES: Array<{ value: OffensiveStrategy; label: string }> = [
  { value: "balanced", label: "Balanced" }, { value: "power-run", label: "Power Run" },
  { value: "outside-run", label: "Outside Run" }, { value: "short-pass", label: "Short Passing" },
  { value: "deep-pass", label: "Deep Passing" },
];
export const DEFENSIVE_STRATEGIES: Array<{ value: DefensiveStrategy; label: string }> = [
  { value: "balanced", label: "Balanced" }, { value: "stop-run", label: "Stop the Run" },
  { value: "press", label: "Press Coverage" }, { value: "protect-deep", label: "Protect Deep" }, { value: "blitz", label: "Blitz" },
];

const OPPONENT_NAMES = ["Ironside Ravens", "Midnight Mavericks", "Rust Belt Rollers", "Cobalt Coyotes", "Neon Nomads", "Blackwood Bulls", "Ember City Elite", "Static Kings", "Harbor Hounds", "Prairie Wolves"];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function pickTodaysOpponent(overall: number) {
  const seed = new Date().toISOString().slice(0, 10);
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const opponentOverall = clamp(overall + (Math.abs(h) % 30) - 15, 55, 95);
  const lineup = synthOpponentLineup(opponentOverall);
  const topPlayers = [...lineup].sort((a, b) =>
    b.overall - a.overall ||
    special(b) - special(a) ||
    (b.strength + b.speed + b.iq) - (a.strength + a.speed + a.iq) ||
    b.popularity - a.popularity
  ).slice(0, 3);
  return { name: OPPONENT_NAMES[Math.abs(h) % OPPONENT_NAMES.length], overall: opponentOverall, lineup, topPlayers };
}

function topStat(p: Player): "strength" | "speed" | "iq" {
  const w = POSITION_WEIGHTS[p.position];
  const values = { strength: p.strength * w.str, speed: p.speed * w.spd, iq: p.iq * w.iq };
  return (Object.entries(values).sort((a, b) => b[1] - a[1])[0][0]) as keyof typeof values;
}
function counterMultiplier(a: Player, d: Player) {
  const wins = { speed: "strength", strength: "iq", iq: "speed" } as const;
  const at = topStat(a), dt = topStat(d);
  if (wins[at] === dt) return 1.10;
  if (wins[dt] === at) return 0.90;
  return 1;
}
function coreRating(p: Player) {
  const w = POSITION_WEIGHTS[p.position];
  return p.strength * w.str + p.speed * w.spd + p.iq * w.iq;
}
const special = (p: Player) => p.signature?.value ?? p.overall;
export function lineupOverall(lineup: (Player | null)[]) {
  const active = lineup.filter(Boolean) as Player[];
  return active.length ? Math.round(active.reduce((sum, p) => sum + p.overall, 0) / active.length) : 0;
}
function synthOpponentLineup(overall: number): Player[] {
  return LINEUP_SLOTS.map((slot, index) => {
    const p = generatePlayer(slotPosition(slot));
    // Spread the roster around its advertised team OVR instead of making
    // every starter exactly the same rating. The fixed slot offset also
    // guarantees that a team has identifiable top players.
    const slotSpread = ((index * 7) % 9) - 4;
    const playerOverall = clamp(overall + slotSpread, 60, 95);
    const delta = playerOverall - p.overall;
    return {
      ...p,
      overall: playerOverall,
      rarity: rarityFromOverall(playerOverall),
      strength: clamp(p.strength + delta, 40, 99),
      speed: clamp(p.speed + delta, 40, 99),
      iq: clamp(p.iq + delta, 40, 99),
      signature: { ...p.signature, value: clamp(special(p) + delta, 40, 99) },
    };
  });
}

type PlayFamily = "power-run" | "outside-run" | "short-pass" | "deep-pass";
const PLAY_NAMES: Record<PlayFamily, string[]> = {
  "power-run": ["power run", "goal-line dive", "inside handoff"], "outside-run": ["outside zone", "sweep", "stretch run"],
  "short-pass": ["screen play", "quick slant", "tight-end option"], "deep-pass": ["deep pass", "play-action shot", "fade route"],
};
function choosePlay(s: OffensiveStrategy): PlayFamily {
  const choices: PlayFamily[] = ({
    balanced: ["power-run", "outside-run", "short-pass", "deep-pass"],
    "power-run": ["power-run", "power-run", "power-run", "short-pass", "deep-pass"],
    "outside-run": ["outside-run", "outside-run", "outside-run", "short-pass", "power-run"],
    "short-pass": ["short-pass", "short-pass", "short-pass", "power-run", "deep-pass"],
    "deep-pass": ["deep-pass", "deep-pass", "deep-pass", "short-pass", "outside-run"],
  } as Record<OffensiveStrategy, PlayFamily[]>)[s];
  return choices[Math.floor(Math.random() * choices.length)];
}
function planEdge(play: PlayFamily, defense: DefensiveStrategy) {
  if (defense === "stop-run") return play.includes("run") ? -7 : 4;
  if (defense === "press") return play === "short-pass" ? -7 : play === "deep-pass" ? 5 : 1;
  if (defense === "protect-deep") return play === "deep-pass" ? -7 : play === "power-run" || play === "short-pass" ? 4 : 1;
  if (defense === "blitz") return play === "power-run" || play === "short-pass" ? -4 : play === "deep-pass" ? 5 : 0;
  return 0;
}
function pick(pool: Player[], positions: Position[]) { const found = pool.filter((p) => positions.includes(p.position)); const src = found.length ? found : pool; return src[Math.floor(Math.random() * src.length)]; }
function matchup(off: Player, def: Player, play: PlayFamily) {
  const coreGap = coreRating(off) * counterMultiplier(off, def) - coreRating(def);
  let os = special(off), ds = special(def);
  if (play === "power-run") { os = special(off) * .6 + off.strength * .4; ds = special(def) * .6 + def.strength * .4; }
  if (play === "outside-run") { os = special(off) * .45 + off.speed * .55; ds = special(def) * .45 + def.speed * .55; }
  if (play === "short-pass") { os = special(off) * .6 + off.iq * .4; ds = special(def) * .6 + def.iq * .4; }
  if (play === "deep-pass") { os = special(off) * .55 + off.speed * .45; ds = special(def) * .55 + def.speed * .45; }
  return (os - ds) * .45 + coreGap * .30;
}

interface DriveOutcome { points: number; narration: string; offPlayer: Player; defPlayer: Player; kind: "td" | "fg" | "punt" | "stuff" | "int"; insight: string }
function driveResult(offense: Player[], defense: Player[], side: "home" | "away", awayName: string | undefined, offensePlan: OffensiveStrategy, defensePlan: DefensiveStrategy): DriveOutcome {
  const family = choosePlay(offensePlan), isPass = family.includes("pass");
  const off = pick(offense, family.includes("run") ? ["RB"] : family === "short-pass" ? ["TE", "WR"] : ["WR"]);
  const def = pick(defense, family === "power-run" ? ["LB", "DL"] : family === "outside-run" ? ["LB", "DB"] : family === "short-pass" ? ["LB", "DB"] : ["DB"]);
  const qb = pick(offense, ["QB"]), ol = pick(offense, ["OL"]), dl = pick(defense, ["DL"]);
  const play = PLAY_NAMES[family][Math.floor(Math.random() * PLAY_NAMES[family].length)];
  const edge = planEdge(family, defensePlan);
  let outcome = matchup(off, def, family) + (special(ol) - special(dl)) * .12 + edge + (Math.random() - .5) * 18;
  if (isPass) outcome += matchup(qb, def, family) * .35;
  const who = side === "home" ? off.name : `${awayName ?? "Away"}'s ${off.name}`;
  const team = side === "home" ? "Your squad" : (awayName ?? "Away");
  const kicker = offense.find((p) => p.position === "K"), punter = offense.find((p) => p.position === "P");
  const mult = counterMultiplier(off, def);
  const insight = edge >= 4 ? `${OFFENSIVE_STRATEGIES.find((s) => s.value === offensePlan)?.label} found a favorable defensive look`
    : edge <= -4 ? `${DEFENSIVE_STRATEGIES.find((s) => s.value === defensePlan)?.label} countered the ${play}`
    : mult > 1 ? `${off.name}'s ${topStat(off)} archetype won its counter` : mult < 1 ? `${def.name}'s ${topStat(def)} archetype won its counter` : `${off.name} matched up with ${def.name}`;
  if (outcome > 10) return { points: 7, narration: `${who} breaks the ${play} for a TOUCHDOWN.`, offPlayer: off, defPlayer: def, kind: "td", insight };
  if (outcome > 3 && kicker) {
    const made = special(kicker) * .7 + kicker.iq * .3 + (Math.random() - .5) * 24 > 62;
    return made ? { points: 3, narration: `Drive stalls; ${kicker.name} drills the field goal.`, offPlayer: kicker, defPlayer: def, kind: "fg", insight }
      : { points: 0, narration: `${kicker.name} pushes the field goal wide.`, offPlayer: kicker, defPlayer: def, kind: "punt", insight };
  }
  if (outcome > -4) return { points: 0, narration: `${def.name} makes the stop. ${punter ? `${punter.name} pins them back with ${special(punter)} Hang Time.` : `${team} punts without a specialist.`}`, offPlayer: punter ?? off, defPlayer: def, kind: "punt", insight };
  if (outcome > -11 || !isPass) return { points: 0, narration: `${def.name} reads the ${play} and forces a three-and-out.`, offPlayer: off, defPlayer: def, kind: "stuff", insight };
  return { points: 0, narration: `${def.name} jumps the ${play} — INTERCEPTION!`, offPlayer: qb, defPlayer: def, kind: "int", insight };
}

function applyStats(d: DriveOutcome, off: PlayerStat, def: PlayerStat, team: TeamStats) {
  off.touches++; if (d.kind === "td") { off.tds++; team.tds++; } else if (d.kind === "fg") { off.fgs++; team.fgs++; }
  else if (d.kind === "int") { team.turnovers++; def.ints++; } else { team.punts++; def.stops++; }
}

export function simulateGame(homeLineup: (Player | null)[], opponentOverall: number, opponentName: string, plan: GamePlan = { offense: "balanced", defense: "balanced" }, opponentLineup?: Player[]): SimResult {
  const home = homeLineup.filter(Boolean) as Player[], away = opponentLineup ?? synthOpponentLineup(opponentOverall);
  const hm = new Map<string, PlayerStat>(), am = new Map<string, PlayerStat>();
  const ensure = (m: Map<string, PlayerStat>, p: Player) => { let s = m.get(p.id); if (!s) { s = { id: p.id, name: p.name, position: p.position, touches: 0, tds: 0, fgs: 0, stops: 0, ints: 0 }; m.set(p.id, s); } return s; };
  let homeScore = 0, awayScore = 0; const log: string[] = [], notes = new Map<string, number>();
  const homeStats: TeamStats = { tds: 0, fgs: 0, punts: 0, turnovers: 0, bigPlays: 0 }, awayStats: TeamStats = { ...homeStats };
  for (let q = 1; q <= 4; q++) { log.push(`— Q${q} —`); for (let d = 0; d < 2; d++) {
    const hd = driveResult(home, away, "home", undefined, plan.offense, "balanced"); homeScore += hd.points; applyStats(hd, ensure(hm, hd.offPlayer), ensure(am, hd.defPlayer), homeStats); notes.set(hd.insight, (notes.get(hd.insight) ?? 0) + 1); log.push(`▸ ${hd.narration} (${homeScore}-${awayScore})`);
    const ad = driveResult(away, home, "away", opponentName, "balanced", plan.defense); awayScore += ad.points; applyStats(ad, ensure(am, ad.offPlayer), ensure(hm, ad.defPlayer), awayStats); log.push(`▸ ${ad.narration} (${homeScore}-${awayScore})`);
  }}
  if (homeScore === awayScore) { const homeEdge = lineupOverall(homeLineup) - opponentOverall + (Math.random() - .5) * 14; if (homeEdge >= 0) { homeScore += 3; homeStats.fgs++; log.push(`⚡ Your squad wins it with a late field goal. (${homeScore}-${awayScore})`); } else { awayScore += 3; awayStats.fgs++; log.push(`⚡ ${opponentName} wins it with a late field goal. (${homeScore}-${awayScore})`); } }
  const win = homeScore > awayScore; log.push(win ? `🏆 Final: Your squad ${homeScore} - ${awayScore} ${opponentName}` : `Final: ${opponentName} ${awayScore} - ${homeScore} Your squad`);
  const homePlayers = [...hm.values()], awayPlayers = [...am.values()];
  const leaders = (team: TeamStats, players: PlayerStat[]) => { team.topScorer = [...players].sort((a, b) => b.tds * 7 + b.fgs * 3 - a.tds * 7 - a.fgs * 3)[0]; team.topDefender = [...players].sort((a, b) => b.ints * 3 + b.stops - a.ints * 3 - a.stops)[0]; };
  leaders(homeStats, homePlayers); leaders(awayStats, awayPlayers);
  return { homeScore, awayScore, win, log, opponentOverall, opponentName, homeOverall: lineupOverall(homeLineup), homeStats, awayStats, homePlayers, awayPlayers,
    insights: [...notes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n}${c > 1 ? ` (${c} drives)` : ""}`) };
}
