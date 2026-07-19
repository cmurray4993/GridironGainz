import type { Player } from "./types";

// UI-only aggregate. Official scores, opponents, play-by-play, standings, and
// rewards are generated and saved by the authoritative season service.
export function lineupOverall(lineup: (Player | null)[]) {
  const active = lineup.filter(Boolean) as Player[];
  return active.length
    ? Math.round(active.reduce((sum, player) => sum + player.overall, 0) / active.length)
    : 0;
}
