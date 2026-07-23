import type { Player } from "@/lib/game/types";

export type SimcastSide = "home" | "away";

export type SimcastPlayKind =
  | "kickoff"
  | "run"
  | "pass_complete"
  | "pass_incomplete"
  | "sack"
  | "turnover"
  | "field_goal"
  | "touchdown"
  | "punt"
  | "final";

export interface SimcastTeam {
  side: SimcastSide;
  name: string;
  lineup: Record<string, Player>;
  fallbackOverall: number;
}

export interface SimcastPlay {
  id: string;
  quarter: number;
  clock: string;
  possession: SimcastSide;
  kind: SimcastPlayKind;
  down: number;
  distance: number;
  yardLine: number;
  yards: number;
  points: number;
  homeScore: number;
  awayScore: number;
  actorSlot: string;
  targetSlot?: string;
  defenderSlot?: string;
  headline: string;
  commentary: string;
  matchup?: {
    label: string;
    offenseValue: number;
    defenseValue: number;
    winner: "offense" | "defense";
  };
}

export interface SimcastReplay {
  version: 1;
  gameId: string;
  home: SimcastTeam;
  away: SimcastTeam;
  plays: SimcastPlay[];
  finalHomeScore: number;
  finalAwayScore: number;
}
